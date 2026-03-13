import Stripe from "stripe";
import { recordAnalyticsEvent } from "@/src/lib/analytics";

export const runtime = "nodejs";

type InsertTipInput = {
  provider: "stripe";
  provider_payment_id: string;
  amount: number;
  currency: string | null;
  letter_id: string | null;
};

type UpsertProfileInput = {
  user_id: string;
  email?: string | null;
  stripe_customer_id?: string | null;
};

type UpsertSubscriptionInput = {
  user_id: string;
  plan_type: string;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  checkout_session_id?: string | null;
  cancel_at_period_end: boolean;
};

type InsertTipError = {
  code?: string | null;
  message: string;
} | null;

type InsertTipResult = {
  error: InsertTipError;
};

type UserLookup = {
  user_id: string | null;
  email?: string | null;
  plan_type?: string | null;
};

type StripeWebhookDeps = {
  stripe: Stripe;
  webhookSecret: string;
  insertTip: (tip: InsertTipInput) => Promise<InsertTipResult>;
  upsertProfile: (profile: UpsertProfileInput) => Promise<void>;
  upsertSubscription: (subscription: UpsertSubscriptionInput) => Promise<void>;
  findUserByStripeCustomerId: (stripeCustomerId: string) => Promise<UserLookup | null>;
  findSubscriptionByStripeSubscriptionId: (subscriptionId: string) => Promise<UserLookup | null>;
};

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseOptionalUuid = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
};

const parseOptionalLetterId = (metadata: Stripe.Metadata | null | undefined): string | null => {
  return parseOptionalUuid(metadata?.letter_id);
};

const parseOptionalUserId = (metadata: Stripe.Metadata | null | undefined): string | null => {
  return parseOptionalUuid(metadata?.user_id);
};

const parsePlanType = (metadata: Stripe.Metadata | null | undefined): string => {
  const raw = metadata?.plan_type;
  if (typeof raw !== "string" || !raw.trim()) {
    return "pro_monthly";
  }
  return raw.trim();
};

const resolveCustomerId = (
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null => {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return "id" in customer ? customer.id : null;
};

const resolveSubscriptionId = (
  subscription: string | Stripe.Subscription | null
): string | null => {
  if (!subscription) return null;
  if (typeof subscription === "string") return subscription;
  return subscription.id;
};

const resolveIsoDate = (unixTimestamp: number | null | undefined): string | null => {
  if (typeof unixTimestamp !== "number" || !Number.isFinite(unixTimestamp) || unixTimestamp <= 0) {
    return null;
  }
  return new Date(unixTimestamp * 1000).toISOString();
};

const readSubscriptionCurrentPeriodEnd = (subscription: Stripe.Subscription): string | null => {
  const value = (subscription as unknown as Record<string, unknown>).current_period_end;
  return typeof value === "number" ? resolveIsoDate(value) : null;
};

const createRuntimeDeps = async (): Promise<StripeWebhookDeps> => {
  const { createServiceRoleClient } = await import("../../../lib/supabaseClients");
  const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
  const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
  const supabase = createServiceRoleClient();

  return {
    stripe,
    webhookSecret,
    insertTip: async (tip: InsertTipInput) => {
      const { error } = await supabase.from("tips").insert(tip);
      return { error: error ? { code: error.code, message: error.message } : null };
    },
    upsertProfile: async (profile: UpsertProfileInput) => {
      const { error } = await supabase.from("profiles").upsert(profile, {
        onConflict: "user_id"
      });
      if (error) throw error;
    },
    upsertSubscription: async (subscription: UpsertSubscriptionInput) => {
      const { error } = await supabase.from("subscriptions").upsert(subscription, {
        onConflict: "stripe_subscription_id"
      });
      if (error) throw error;
    },
    findUserByStripeCustomerId: async (stripeCustomerId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();

      if (error) throw error;
      return (data as UserLookup | null) ?? null;
    },
    findSubscriptionByStripeSubscriptionId: async (subscriptionId: string) => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("user_id, plan_type")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (error) throw error;
      return (data as UserLookup | null) ?? null;
    }
  };
};

const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent,
  deps: StripeWebhookDeps
): Promise<Response> => {
  const providerPaymentId = paymentIntent.id;
  const letterId = parseOptionalLetterId(paymentIntent.metadata);

  const { error } = await deps.insertTip({
    provider: "stripe",
    provider_payment_id: providerPaymentId,
    amount: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    letter_id: letterId
  });

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ ok: true, duplicate: true, providerPaymentId });
    }

    console.error("stripe_webhook_insert_error", {
      message: error.message,
      code: error.code,
      providerPaymentId,
      eventType: "payment_intent.succeeded"
    });

    return jsonResponse({ ok: false, error: "tip_insert_failed" }, 500);
  }

  return jsonResponse({ ok: true, providerPaymentId });
};

const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session,
  deps: StripeWebhookDeps
): Promise<Response> => {
  if (session.mode !== "subscription") {
    return jsonResponse({ ok: true, ignored: true, eventType: "checkout.session.completed" });
  }

  const userId = parseOptionalUserId(session.metadata) ?? parseOptionalUuid(session.client_reference_id);
  const stripeCustomerId = resolveCustomerId(session.customer);
  const stripeSubscriptionId = resolveSubscriptionId(session.subscription);

  if (!userId || !stripeSubscriptionId) {
    return jsonResponse({
      ok: true,
      ignored: true,
      eventType: "checkout.session.completed",
      reason: "missing_user_or_subscription"
    });
  }

  await deps.upsertProfile({
    user_id: userId,
    stripe_customer_id: stripeCustomerId
  });

  await deps.upsertSubscription({
    user_id: userId,
    plan_type: parsePlanType(session.metadata),
    status: "incomplete",
    current_period_end: null,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    checkout_session_id: session.id,
    cancel_at_period_end: false
  });

  await recordAnalyticsEvent({
    eventName: "checkout_completed",
    userId,
    isPaid: true,
    source: "stripe_webhook",
    properties: {
      source: "stripe_webhook",
      checkout_session_id: session.id,
      stripe_subscription_id: stripeSubscriptionId,
      plan_type: parsePlanType(session.metadata)
    }
  }).catch((error) => {
    console.error("checkout_completed_analytics_error", { error, userId, sessionId: session.id });
  });

  return jsonResponse({
    ok: true,
    eventType: "checkout.session.completed",
    stripeSubscriptionId
  });
};

const resolveSubscriptionUser = async (
  subscription: Stripe.Subscription,
  deps: StripeWebhookDeps
): Promise<{ userId: string | null; planType: string }> => {
  const metadataUserId = parseOptionalUserId(subscription.metadata);
  if (metadataUserId) {
    return {
      userId: metadataUserId,
      planType: parsePlanType(subscription.metadata)
    };
  }

  const existingSubscription = await deps.findSubscriptionByStripeSubscriptionId(subscription.id);
  if (existingSubscription?.user_id) {
    return {
      userId: existingSubscription.user_id,
      planType:
        typeof existingSubscription.plan_type === "string" && existingSubscription.plan_type.trim()
          ? existingSubscription.plan_type
          : "pro_monthly"
    };
  }

  const stripeCustomerId = resolveCustomerId(subscription.customer);
  if (stripeCustomerId) {
    const profile = await deps.findUserByStripeCustomerId(stripeCustomerId);
    if (profile?.user_id) {
      return {
        userId: profile.user_id,
        planType: "pro_monthly"
      };
    }
  }

  return {
    userId: null,
    planType: "pro_monthly"
  };
};

const handleSubscriptionUpdated = async (
  subscription: Stripe.Subscription,
  deps: StripeWebhookDeps
): Promise<Response> => {
  const stripeCustomerId = resolveCustomerId(subscription.customer);
  const { userId, planType } = await resolveSubscriptionUser(subscription, deps);

  if (!userId) {
    return jsonResponse({
      ok: true,
      ignored: true,
      eventType: "customer.subscription.updated",
      reason: "missing_user"
    });
  }

  if (stripeCustomerId) {
    await deps.upsertProfile({
      user_id: userId,
      stripe_customer_id: stripeCustomerId
    });
  }

  await deps.upsertSubscription({
    user_id: userId,
    plan_type: planType,
    status: subscription.status,
    current_period_end: readSubscriptionCurrentPeriodEnd(subscription),
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscription.id,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
  });

  return jsonResponse({
    ok: true,
    eventType: "customer.subscription.updated",
    stripeSubscriptionId: subscription.id,
    status: subscription.status
  });
};

export async function handleStripeWebhook(request: Request, deps: StripeWebhookDeps): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ ok: false, error: "missing_stripe_signature" }, 400);
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = deps.stripe.webhooks.constructEvent(rawBody, signature, deps.webhookSecret);
  } catch (error) {
    console.error("stripe_webhook_signature_error", { error });
    return jsonResponse({ ok: false, error: "invalid_signature" }, 400);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        return handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, deps);
      case "checkout.session.completed":
        return handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, deps);
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return handleSubscriptionUpdated(event.data.object as Stripe.Subscription, deps);
      default:
        return jsonResponse({ ok: true, ignored: true, eventType: event.type });
    }
  } catch (error) {
    console.error("stripe_webhook_processing_error", {
      eventType: event.type,
      error: error instanceof Error ? error.message : error
    });
    return jsonResponse({ ok: false, error: "webhook_processing_failed" }, 500);
  }
}

export async function POST(request: Request) {
  let deps: StripeWebhookDeps;

  try {
    deps = await createRuntimeDeps();
  } catch (error) {
    const message = error instanceof Error ? error.message : "configuration_error";
    console.error("stripe_webhook_config_error", { message });
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return handleStripeWebhook(request, deps);
}
