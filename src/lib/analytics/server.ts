import type { ViewerState } from "../../../app/lib/viewer.ts";
import { createServiceRoleClient } from "../../../app/lib/supabaseClients.ts";
import type { AnalyticsEventName } from "./events.ts";
import { sanitizeAnalyticsProperties, type AnalyticsProperties } from "./shared.ts";

type RecordAnalyticsEventInput = {
  eventName: AnalyticsEventName;
  anonymousId?: string | null;
  userId?: string | null;
  isPaid?: boolean | null;
  page?: string | null;
  source?: string | null;
  properties?: Record<string, unknown> | null;
  viewer?: ViewerState | null;
};

export const recordAnalyticsEvent = async ({
  eventName,
  anonymousId,
  userId,
  isPaid,
  page,
  source,
  properties,
  viewer
}: RecordAnalyticsEventInput): Promise<void> => {
  const resolvedUserId = userId ?? viewer?.userId ?? null;
  const resolvedIsPaid = Boolean(isPaid ?? viewer?.isPaid ?? false);
  const sanitizedProperties = sanitizeAnalyticsProperties(properties);
  const resolvedPage =
    page ??
    (typeof sanitizedProperties.page === "string" ? sanitizedProperties.page : null) ??
    null;
  const resolvedSource =
    source ??
    (typeof sanitizedProperties.source === "string" ? sanitizedProperties.source : null) ??
    null;
  const eventProperties: AnalyticsProperties = {
    ...sanitizedProperties,
    timestamp:
      typeof sanitizedProperties.timestamp === "string"
        ? sanitizedProperties.timestamp
        : new Date().toISOString()
  };

  if (!resolvedUserId && !anonymousId) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("analytics_events").insert({
    user_id: resolvedUserId,
    anonymous_id: anonymousId ?? null,
    event_name: eventName,
    page: resolvedPage,
    source: resolvedSource,
    is_paid: resolvedIsPaid,
    event_properties: eventProperties
  });

  if (error) {
    throw error;
  }
};
