import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { jsonResponse } from "@/app/lib/apiResponse";
import { getViewerFromCookies } from "@/app/lib/viewer";
import {
  loadUserNotificationPreferences,
  upsertUserNotificationPreferences
} from "@/app/lib/userNotificationPreferences";

export const runtime = "nodejs";

type NotificationPreferencesRequest = {
  weeklyDigestEnabled?: unknown;
  deadlineAlertEnabled?: unknown;
  outcomeReminderEnabled?: unknown;
};

const toBoolean = (value: unknown): boolean | null => {
  return typeof value === "boolean" ? value : null;
};

export async function GET() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const { preferences, error } = await loadUserNotificationPreferences(viewer.userId);
  if (error) {
    return jsonResponse({ ok: false, error }, 500);
  }

  return jsonResponse({
    ok: true,
    preferences
  });
}

export async function POST(request: Request) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as NotificationPreferencesRequest;
  const weeklyDigestEnabled = toBoolean(body.weeklyDigestEnabled);
  const deadlineAlertEnabled = toBoolean(body.deadlineAlertEnabled);
  const outcomeReminderEnabled = toBoolean(body.outcomeReminderEnabled);

  if (weeklyDigestEnabled === null || deadlineAlertEnabled === null || outcomeReminderEnabled === null) {
    return jsonResponse({ ok: false, error: "invalid_notification_preferences" }, 400);
  }

  const { preferences, error } = await upsertUserNotificationPreferences(viewer.userId, {
    weeklyDigestEnabled,
    deadlineAlertEnabled,
    outcomeReminderEnabled
  });

  if (error) {
    return jsonResponse({ ok: false, error }, 500);
  }

  return jsonResponse({
    ok: true,
    preferences
  });
}
