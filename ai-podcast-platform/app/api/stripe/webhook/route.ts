import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

type JobRunStatus = "started" | "succeeded" | "failed" | "skipped";

const getEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const createStripeClient = () => {
  const key = getEnv("STRIPE_SECRET_KEY");
  return new Stripe(key);
};

const createSupabaseAdmin = () => {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

const upsertJobRun = async (
  status: JobRunStatus,
  payload: Record<string, unknown>,
  error: string | null,
  idempotencyKey: string,
  stepName: string
) => {
  const supabase = createSupabaseAdmin();

  const result = await supabase
    .from("job_runs")
    .upsert(
      {
        job_name: "stripe_webhook",
        step_name: stepName,
        idempotency_key: idempotencyKey,
        status,
        payload,
        error,
        finished_at: status === "started" ? null : new Date().toISOString()
      },
      {
        onConflict: "job_name,step_name,idempotency_key"
      }
    );

  if (result.error) {
    throw result.error;
  }
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

export async function POST(request: Request) {
  let stripe: Stripe;
  let webhookSecret: string;
  try {
    stripe = createStripeClient();
    webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
  } catch (error) {
    const message = error instanceof Error ? error.message : "configuration_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ ok: false, error: "missing_stripe_signature" }, 400);
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_signature" }, 400);
  }

  const jobKey = event.id;
  const stepName = event.type;

  try {
    await upsertJobRun("started", { eventType: event.type }, null, jobKey, stepName);

    if (event.type !== "payment_intent.succeeded") {
      await upsertJobRun(
        "skipped",
        { eventType: event.type, reason: "unsupported_event" },
        null,
        jobKey,
        stepName
      );
      return jsonResponse({ ok: true, skipped: true, reason: "unsupported_event" });
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const providerPaymentId = paymentIntent.id;

    const supabase = createSupabaseAdmin();
    const insertResult = await supabase.from("tips").insert({
      provider: "stripe",
      provider_payment_id: providerPaymentId,
      provider_event_id: event.id,
      amount: paymentIntent.amount_received,
      currency: paymentIntent.currency,
      payload: {
        event_type: event.type,
        payment_intent_id: paymentIntent.id,
        amount_received: paymentIntent.amount_received,
        currency: paymentIntent.currency
      }
    });

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        await upsertJobRun(
          "skipped",
          {
            eventType: event.type,
            providerPaymentId,
            reason: "duplicate_payment"
          },
          null,
          jobKey,
          stepName
        );

        return jsonResponse({ ok: true, duplicate: true, providerPaymentId });
      }

      throw new Error(insertResult.error.message);
    }

    await upsertJobRun(
      "succeeded",
      {
        eventType: event.type,
        providerPaymentId
      },
      null,
      jobKey,
      stepName
    );

    return jsonResponse({ ok: true, providerPaymentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    try {
      await upsertJobRun(
        "failed",
        {
          eventType: event.type
        },
        message,
        jobKey,
        stepName
      );
    } catch {
      // no-op: keep original webhook error as response
    }

    return jsonResponse({ ok: false, error: message }, 500);
  }
}
