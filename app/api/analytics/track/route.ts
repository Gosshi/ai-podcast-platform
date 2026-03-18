import { getViewerFromCookies } from "@/app/lib/viewer";
import { jsonResponse, toNonEmptyString, checkRateLimit } from "@/app/lib/apiResponse";
import { analyticsLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";
import { isAnalyticsEventName, recordAnalyticsEvent } from "@/src/lib/analytics";

export const runtime = "nodejs";

type TrackAnalyticsRequest = {
  anonymousId?: unknown;
  eventName?: unknown;
  properties?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const rateLimitResponse = checkRateLimit(analyticsLimiter, extractRateLimitKey(request));
  if (rateLimitResponse) return rateLimitResponse;

  const viewer = await getViewerFromCookies();
  const body = (await request.json().catch(() => ({}))) as TrackAnalyticsRequest;

  if (!isAnalyticsEventName(body.eventName)) {
    return jsonResponse({ ok: false, error: "invalid_event_name" }, 400);
  }

  const anonymousId = toNonEmptyString(body.anonymousId);
  if (!viewer && !anonymousId) {
    return jsonResponse({ ok: false, error: "anonymous_id_required" }, 400);
  }

  const properties =
    body.properties && typeof body.properties === "object" && !Array.isArray(body.properties)
      ? (body.properties as Record<string, unknown>)
      : {};

  try {
    await recordAnalyticsEvent({
      eventName: body.eventName,
      anonymousId,
      viewer,
      properties
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("analytics_track_error", { error, eventName: body.eventName });
    return jsonResponse({ ok: false, error: "analytics_track_failed" }, 500);
  }
}

