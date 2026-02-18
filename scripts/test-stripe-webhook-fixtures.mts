import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { handleStripeWebhook } from "../app/api/stripe/webhook/route.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_SECRET = "whsec_fixture_test";
const stripe = new Stripe("sk_test_fixture");

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const loadFixture = async (name: string): Promise<string> => {
  const fixturePath = path.resolve(__dirname, "..", "tests", "fixtures", "stripe", name);
  return readFile(fixturePath, "utf8");
};

const signPayload = (payload: string): string => {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: FIXTURE_SECRET });
};

const run = async (): Promise<void> => {
  const insertedPayments = new Set<string>();
  const insertedTips: { provider_payment_id: string; letter_id: string | null }[] = [];

  const deps = {
    stripe,
    webhookSecret: FIXTURE_SECRET,
    insertTip: async (tip: {
      provider: "stripe";
      provider_payment_id: string;
      amount: number;
      currency: string | null;
      letter_id: string | null;
    }) => {
      if (insertedPayments.has(tip.provider_payment_id)) {
        return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }

      insertedPayments.add(tip.provider_payment_id);
      insertedTips.push({
        provider_payment_id: tip.provider_payment_id,
        letter_id: tip.letter_id
      });
      return { error: null };
    }
  };

  const successPayload = await loadFixture("payment_intent_succeeded.json");
  const successSignature = signPayload(successPayload);

  const firstResponse = await handleStripeWebhook(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": successSignature
      },
      body: successPayload
    }),
    deps
  );
  const firstBody = (await firstResponse.json()) as Record<string, unknown>;

  assert(firstResponse.status === 200, `first webhook status should be 200, got ${firstResponse.status}`);
  assert(firstBody.ok === true, "first webhook call should return ok=true");
  assert(firstBody.duplicate !== true, "first webhook call should not be duplicate");
  assert(
    insertedTips[0]?.letter_id === "11111111-1111-4111-8111-111111111111",
    `first webhook call should keep metadata letter_id, got ${insertedTips[0]?.letter_id ?? "null"}`
  );

  const secondResponse = await handleStripeWebhook(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": successSignature
      },
      body: successPayload
    }),
    deps
  );
  const secondBody = (await secondResponse.json()) as Record<string, unknown>;

  assert(secondResponse.status === 200, `second webhook status should be 200, got ${secondResponse.status}`);
  assert(secondBody.ok === true, "second webhook call should return ok=true");
  assert(secondBody.duplicate === true, "second webhook call should be duplicate no-op");
  assert(insertedPayments.size === 1, `tips insert should be idempotent, got ${insertedPayments.size}`);

  const withoutMetadataPayload = await loadFixture("payment_intent_succeeded_without_metadata.json");
  const withoutMetadataSignature = signPayload(withoutMetadataPayload);

  const withoutMetadataResponse = await handleStripeWebhook(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": withoutMetadataSignature
      },
      body: withoutMetadataPayload
    }),
    deps
  );
  const withoutMetadataBody = (await withoutMetadataResponse.json()) as Record<string, unknown>;

  assert(
    withoutMetadataResponse.status === 200,
    `without-metadata webhook status should be 200, got ${withoutMetadataResponse.status}`
  );
  assert(withoutMetadataBody.ok === true, "without-metadata webhook call should return ok=true");
  assert(
    insertedTips[1]?.letter_id === null,
    `without-metadata webhook call should store null letter_id, got ${insertedTips[1]?.letter_id ?? "undefined"}`
  );

  const invalidMetadataPayload = await loadFixture("payment_intent_succeeded_invalid_letter_id.json");
  const invalidMetadataSignature = signPayload(invalidMetadataPayload);

  const invalidMetadataResponse = await handleStripeWebhook(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": invalidMetadataSignature
      },
      body: invalidMetadataPayload
    }),
    deps
  );
  const invalidMetadataBody = (await invalidMetadataResponse.json()) as Record<string, unknown>;

  assert(
    invalidMetadataResponse.status === 200,
    `invalid-metadata webhook status should be 200, got ${invalidMetadataResponse.status}`
  );
  assert(invalidMetadataBody.ok === true, "invalid-metadata webhook call should return ok=true");
  assert(
    insertedTips[2]?.letter_id === null,
    `invalid-metadata webhook call should store null letter_id, got ${insertedTips[2]?.letter_id ?? "undefined"}`
  );
  assert(insertedPayments.size === 3, `three unique payment intents should be stored, got ${insertedPayments.size}`);

  const ignoredPayload = await loadFixture("invoice_paid.json");
  const ignoredSignature = signPayload(ignoredPayload);

  const ignoredResponse = await handleStripeWebhook(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": ignoredSignature
      },
      body: ignoredPayload
    }),
    deps
  );
  const ignoredBody = (await ignoredResponse.json()) as Record<string, unknown>;

  assert(ignoredResponse.status === 200, `ignored webhook status should be 200, got ${ignoredResponse.status}`);
  assert(ignoredBody.ok === true, "ignored webhook call should return ok=true");
  assert(ignoredBody.ignored === true, "ignored webhook call should return ignored=true");
  assert(insertedPayments.size === 3, "ignored webhook should not insert tips");

  console.log("stripe webhook fixtures passed");
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`stripe webhook fixtures failed: ${message}`);
  process.exitCode = 1;
});
