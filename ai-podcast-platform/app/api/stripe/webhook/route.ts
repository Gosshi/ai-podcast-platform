import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  let stripe: Stripe;
  let supabaseUrl: string;
  let serviceRoleKey: string;
  let webhookSecret: string;

  try {
    stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
  } catch (error) {
    const message = error instanceof Error ? error.message : "configuration_error";
    console.error("stripe_webhook_config_error", { message });
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ ok: false, error: "missing_stripe_signature" }, 400);
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("stripe_webhook_signature_error", { error });
    return jsonResponse({ ok: false, error: "invalid_signature" }, 400);
  }

  if (event.type !== "payment_intent.succeeded") {
    return jsonResponse({ ok: true, ignored: true, eventType: event.type });
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const providerPaymentId = paymentIntent.id;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { error } = await supabase.from("tips").insert({
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
