import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { sendEmail } from "@/app/lib/email";
import { buildAlertEmail } from "@/app/lib/emailTemplates";
import type { StoredUserAlert } from "@/app/lib/alerts";

export const runtime = "nodejs";

const MAX_BATCH_SIZE = 50;

type AlertType = "deadline_due_soon" | "outcome_reminder" | "weekly_digest_ready" | "watchlist_due_soon";

type AlertRow = {
  id: string;
  user_id: string;
  alert_type: AlertType;
  source_id: string;
  source_kind: string;
  episode_id: string | null;
  title: string;
  summary: string;
  urgency: string;
  due_at: string | null;
  is_read: boolean;
  is_sent: boolean;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
  alert_payload: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
};

type NotificationPreferencesRow = {
  weekly_digest_enabled: boolean;
  deadline_alert_enabled: boolean;
  outcome_reminder_enabled: boolean;
};

type AlertLink = {
  href: string;
  label: string;
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  deadline_due_soon: "期限アラート",
  watchlist_due_soon: "ウォッチリスト期限",
  outcome_reminder: "結果リマインダー",
  weekly_digest_ready: "週次ダイジェスト"
};

const isAlertLink = (value: unknown): value is AlertLink => {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as AlertLink).href === "string" &&
      typeof (value as AlertLink).label === "string"
  );
};

const toStoredAlert = (row: AlertRow): StoredUserAlert => {
  const payload = row.alert_payload ?? {};
  const links = Array.isArray(payload.links) ? payload.links.filter(isAlertLink) : [];

  return {
    id: row.id,
    userId: row.user_id,
    alertType: row.alert_type,
    alertTypeLabel: ALERT_TYPE_LABELS[row.alert_type] ?? row.alert_type,
    sourceId: row.source_id,
    sourceKind: row.source_kind as "judgment_card" | "user_decision" | "weekly_digest",
    episodeId: row.episode_id,
    title: row.title,
    summary: row.summary,
    urgency: row.urgency as "critical" | "high" | "medium" | "low",
    dueAt: row.due_at,
    isRead: row.is_read,
    isSent: row.is_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    judgmentCardId: typeof payload.judgment_card_id === "string" ? payload.judgment_card_id : null,
    userDecisionId: typeof payload.user_decision_id === "string" ? payload.user_decision_id : null,
    previewLimited: Boolean(payload.preview_limited),
    links
  };
};

const isAlertTypeEnabledForUser = (
  alertType: AlertType,
  prefs: NotificationPreferencesRow | null
): boolean => {
  if (!prefs) return true; // Default: all enabled

  switch (alertType) {
    case "deadline_due_soon":
    case "watchlist_due_soon":
      return prefs.deadline_alert_enabled;
    case "outcome_reminder":
      return prefs.outcome_reminder_enabled;
    case "weekly_digest_ready":
      return prefs.weekly_digest_enabled;
    default:
      return true;
  }
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

export async function POST(request: Request) {
  // Authenticate via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return jsonResponse({ ok: false, error: "cron_secret_not_configured" }, 503);
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (token !== cronSecret) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const supabase = createServiceRoleClient();

  // Fetch unsent, non-dismissed alerts
  const { data: alertRows, error: alertError } = await supabase
    .from("user_alerts")
    .select(
      "id, user_id, alert_type, source_id, source_kind, episode_id, title, summary, urgency, due_at, is_read, is_sent, dismissed_at, created_at, updated_at, alert_payload"
    )
    .eq("is_sent", false)
    .is("dismissed_at", null)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);

  if (alertError) {
    return jsonResponse({ ok: false, error: alertError.message }, 500);
  }

  const alerts = (alertRows as AlertRow[] | null) ?? [];

  if (alerts.length === 0) {
    return jsonResponse({ ok: true, sent: 0, skipped: 0, failed: 0 });
  }

  // Collect unique user IDs
  const userIds = [...new Set(alerts.map((a) => a.user_id))];

  // Fetch user emails
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", userIds);

  if (profileError) {
    return jsonResponse({ ok: false, error: profileError.message }, 500);
  }

  const emailByUserId = new Map<string, string>();
  for (const profile of (profileRows as ProfileRow[] | null) ?? []) {
    if (profile.email) {
      emailByUserId.set(profile.id, profile.email);
    }
  }

  // Fetch notification preferences
  const { data: prefRows, error: prefError } = await supabase
    .from("user_notification_preferences")
    .select("user_id, weekly_digest_enabled, deadline_alert_enabled, outcome_reminder_enabled")
    .in("user_id", userIds);

  if (prefError) {
    return jsonResponse({ ok: false, error: prefError.message }, 500);
  }

  const prefsByUserId = new Map<string, NotificationPreferencesRow>();
  for (const row of (prefRows as (NotificationPreferencesRow & { user_id: string })[] | null) ?? []) {
    prefsByUserId.set(row.user_id, row);
  }

  // Process each alert
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const sentIds: string[] = [];

  for (const alertRow of alerts) {
    const email = emailByUserId.get(alertRow.user_id);
    if (!email) {
      skipped++;
      continue;
    }

    const prefs = prefsByUserId.get(alertRow.user_id) ?? null;
    if (!isAlertTypeEnabledForUser(alertRow.alert_type, prefs)) {
      skipped++;
      continue;
    }

    const storedAlert = toStoredAlert(alertRow);
    const emailContent = buildAlertEmail(storedAlert);

    const result = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    });

    if (result.ok) {
      sent++;
      sentIds.push(alertRow.id);
    } else {
      failed++;
    }
  }

  // Mark sent alerts as is_sent = true
  if (sentIds.length > 0) {
    const { error: updateError } = await supabase
      .from("user_alerts")
      .update({ is_sent: true })
      .in("id", sentIds);

    if (updateError) {
      return jsonResponse({
        ok: true,
        sent,
        skipped,
        failed,
        warning: `sent ${sent} emails but failed to update is_sent: ${updateError.message}`
      });
    }
  }

  return jsonResponse({ ok: true, sent, skipped, failed });
}
