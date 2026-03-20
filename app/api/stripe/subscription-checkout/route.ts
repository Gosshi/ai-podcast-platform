import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { jsonResponse, getRequiredEnv, checkRateLimit } from "@/app/lib/apiResponse";
import { paymentLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";
import { getStripeTrialConsumedStatuses, resolveStripeTrialDays } from "@/app/lib/stripeTrial";
import { getViewerFromCookies } from "../../../lib/viewer";
import { createServiceRoleClient } from "../../../lib/supabaseClients";
import { recordAnalyticsEvent } from "@/src/lib/analytics";
import Stripe from "stripe";

export const runtime = "nodejs";

type SubscriptionCheckoutRequest = {
  source?: unknown;
};

const getOrigin = (request: Request): string => {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    return appBaseUrl.replace(/\/+$/, "");
  }

  const requestUrl = new URL(request.url);
  return requestUrl.origin;
};

const getStripeCustomerId = async (userId: string): Promise<string | null> => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.stripe_customer_id ?? null;
};

const hasStartedPaidSubscriptionBefore = async (userId: string): Promise<boolean> => {
  const supabase = createServiceRoleClient();
  const { count, error } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", getStripeTrialConsumedStatuses());

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
};

const updateProfileCustomerId = async (userId: string, stripeCustomerId: string): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    throw error;
  }
};

const insertPendingSubscription = async (params: {
  userId: string;
  stripeCustomerId: string;
  checkoutSessionId: string;
  stripeSubscriptionId: string | null;
}): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("subscriptions").insert({
    user_id: params.userId,
    plan_type: "pro_monthly",
    status: "inactive",
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    checkout_session_id: params.checkoutSessionId,
    cancel_at_period_end: false
  });

  if (error && error.code !== "23505") {
    throw error;
  }
};

export async function POST(request: Request): Promise<Response> {
  const rateLimitResponse = checkRateLimit(paymentLimiter, extractRateLimitKey(request));
  if (rateLimitResponse) return rateLimitResponse;

  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as SubscriptionCheckoutRequest;
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : null;

  if (viewer.isPaid) {
    return jsonResponse({ ok: false, error: "already_paid" }, 409);
  }

  let stripe: Stripe;
  let priceId: string;
  try {
    stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
    priceId = getRequiredEnv("STRIPE_PRICE_PRO_MONTHLY");
  } catch (error) {
    const message = error instanceof Error ? error.message : "configuration_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  try {
    const origin = getOrigin(request);
    let stripeCustomerId = await getStripeCustomerId(viewer.userId);
    const configuredTrialDays = resolveStripeTrialDays();
    const trialDays =
      configuredTrialDays > 0 && !(await hasStartedPaidSubscriptionBefore(viewer.userId))
        ? configuredTrialDays
        : null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: viewer.email ?? undefined,
        metadata: {
          user_id: viewer.userId
        }
      });
      stripeCustomerId = customer.id;
      await updateProfileCustomerId(viewer.userId, stripeCustomerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: viewer.userId,
      success_url: `${origin}/account?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/account?subscription=cancel`,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        user_id: viewer.userId,
        plan_type: "pro_monthly"
      },
      subscription_data: {
        ...(trialDays ? { trial_period_days: trialDays } : {}),
        metadata: {
          user_id: viewer.userId,
          plan_type: "pro_monthly"
        }
      }
    });

    await insertPendingSubscription({
      userId: viewer.userId,
      stripeCustomerId,
      checkoutSessionId: session.id,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null
    });

    await recordAnalyticsEvent({
      eventName: "checkout_started",
      userId: viewer.userId,
      isPaid: viewer.isPaid,
      page: source,
      source: source ? `subscription_checkout:${source}` : "subscription_checkout",
      properties: {
        page: source,
        source: source ? `subscription_checkout:${source}` : "subscription_checkout",
        plan_type: "pro_monthly",
        checkout_session_id: session.id,
        trial_days: trialDays ?? 0
      }
    }).catch((error) => {
      console.error("checkout_started_analytics_error", { error, userId: viewer.userId });
    });

    return jsonResponse({
      ok: true,
      url: session.url
    });
  } catch (error) {
    console.error("subscription_checkout_create_error", { error });
    return jsonResponse({ ok: false, error: "checkout_create_failed" }, 500);
  }
}
