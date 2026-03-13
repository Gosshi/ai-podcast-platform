import { getViewerFromCookies } from "@/app/lib/viewer";
import { isAnalyticsEventName, recordAnalyticsEvent } from "@/src/lib/analytics";

export const runtime = "nodejs";

type TrackAnalyticsRequest = {
  anonymousId?: unknown;
  eventName?: unknown;
  properties?: unknown;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewerFromCookies();
  const body = (await request.json().catch(() => ({}))) as TrackAnalyticsRequest;

  if (!isAnalyticsEventName(body.eventName)) {
    return jsonResponse({ ok: false, error: "invalid_event_name" }, 400);
  }

  const anonymousId = toOptionalString(body.anonymousId);
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

