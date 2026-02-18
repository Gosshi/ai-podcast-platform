import Stripe from "stripe";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_AMOUNTS = new Set([200, 500, 1000]);

type CheckoutRequestBody = {
  letter_id?: unknown;
  amount?: unknown;
};

type CheckoutSessionInput = {
  letterId: string;
  amount: number;
  origin: string;
};

type CheckoutDeps = {
  createSession: (input: CheckoutSessionInput) => Promise<{ url: string | null }>;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const parseLetterId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const parseAmount = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (!ALLOWED_AMOUNTS.has(value)) {
    return null;
  }
  return value;
};

const getOrigin = (request: Request): string => {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    return appBaseUrl.replace(/\/+$/, "");
  }

  const requestUrl = new URL(request.url);
  return requestUrl.origin;
};

const createRuntimeDeps = (): CheckoutDeps => {
  const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));

  return {
    createSession: async ({ letterId, amount, origin }) => {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${origin}/letters/${letterId}/tip?status=success`,
        cancel_url: `${origin}/letters/${letterId}/tip?status=cancel`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "jpy",
              unit_amount: amount,
              product_data: {
                name: "お便り優先読み上げチップ"
              }
            }
          }
        ],
        metadata: {
          letter_id: letterId
        },
        payment_intent_data: {
          metadata: {
            letter_id: letterId
          }
        }
      });

      return { url: session.url };
    }
  };
};

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as CheckoutRequestBody;
  const letterId = parseLetterId(body.letter_id);
  const amount = parseAmount(body.amount);

  if (!letterId || !amount) {
    return jsonResponse({ ok: false, error: "validation_error" }, 400);
  }

  const origin = getOrigin(request);

  let deps: CheckoutDeps;
  try {
    deps = createRuntimeDeps();
  } catch (error) {
    const message = error instanceof Error ? error.message : "configuration_error";
    console.error("stripe_checkout_config_error", { message });
    return jsonResponse({ ok: false, error: message }, 500);
  }

  try {
    const { url } = await deps.createSession({ letterId, amount, origin });
    if (!url) {
      return jsonResponse({ ok: false, error: "checkout_url_missing" }, 500);
    }

    return jsonResponse({ ok: true, url });
  } catch (error) {
    console.error("stripe_checkout_create_error", { error });
    return jsonResponse({ ok: false, error: "checkout_create_failed" }, 500);
  }
}
