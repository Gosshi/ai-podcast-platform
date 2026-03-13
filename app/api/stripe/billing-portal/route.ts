import Stripe from "stripe";
import { getViewerFromCookies } from "../../../lib/viewer";
import { recordAnalyticsEvent } from "@/src/lib/analytics";

export const runtime = "nodejs";

type BillingPortalRequest = {
  source?: unknown;
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

const getOrigin = (request: Request): string => {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    return appBaseUrl.replace(/\/+$/, "");
  }

  const requestUrl = new URL(request.url);
  return requestUrl.origin;
};

export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as BillingPortalRequest;
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : null;

  if (!viewer.stripeCustomerId) {
    return jsonResponse({ ok: false, error: "billing_customer_missing" }, 400);
  }

  let stripe: Stripe;
  try {
    stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "configuration_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: viewer.stripeCustomerId,
      return_url: `${getOrigin(request)}/account`,
      ...(process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID
        ? { configuration: process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID }
        : {})
    });

    if (!session.url) {
      return jsonResponse({ ok: false, error: "billing_portal_url_missing" }, 500);
    }

    await recordAnalyticsEvent({
      eventName: "billing_portal_open",
      userId: viewer.userId,
      isPaid: viewer.isPaid,
      page: source,
      source: source ? `billing_portal:${source}` : "billing_portal",
      properties: {
        page: source,
        source: source ? `billing_portal:${source}` : "billing_portal"
      }
    }).catch((error) => {
      console.error("billing_portal_analytics_error", { error, userId: viewer.userId });
    });

    return jsonResponse({
      ok: true,
      url: session.url
    });
  } catch (error) {
    console.error("billing_portal_create_error", { error });
    return jsonResponse({ ok: false, error: "billing_portal_create_failed" }, 500);
  }
}
