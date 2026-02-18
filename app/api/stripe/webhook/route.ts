import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

type InsertTipInput = {
  provider: "stripe";
  provider_payment_id: string;
  amount: number;
  currency: string | null;
  letter_id: string | null;
};

type InsertTipError = {
  code?: string | null;
  message: string;
} | null;

type InsertTipResult = {
  error: InsertTipError;
};

type StripeWebhookDeps = {
  stripe: Stripe;
  webhookSecret: string;
  insertTip: (tip: InsertTipInput) => Promise<InsertTipResult>;
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

const createRuntimeDeps = (): StripeWebhookDeps => {
  const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return {
    stripe,
    webhookSecret,
    insertTip: async (tip: InsertTipInput) => {
      const { error } = await supabase.from("tips").insert(tip);
      return { error: error ? { code: error.code, message: error.message } : null };
    }
  };
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

  if (event.type !== "payment_intent.succeeded") {
    return jsonResponse({ ok: true, ignored: true, eventType: event.type });
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const providerPaymentId = paymentIntent.id;

  const { error } = await deps.insertTip({
    provider: "stripe",
    provider_payment_id: providerPaymentId,
    amount: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    letter_id: null
  });

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ ok: true, duplicate: true, providerPaymentId });
    }

    console.error("stripe_webhook_insert_error", {
      message: error.message,
      code: error.code,
      providerPaymentId,
      eventType: event.type
    });

    return jsonResponse({ ok: false, error: "tip_insert_failed" }, 500);
  }

  return jsonResponse({ ok: true, providerPaymentId });
}

export async function POST(request: Request) {
  let deps: StripeWebhookDeps;

  try {
    deps = createRuntimeDeps();
  } catch (error) {
    const message = error instanceof Error ? error.message : "configuration_error";
    console.error("stripe_webhook_config_error", { message });
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return handleStripeWebhook(request, deps);
}
