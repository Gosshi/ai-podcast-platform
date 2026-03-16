import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { sendEmail } from "@/app/lib/email";
import { buildAlertEmail } from "@/app/lib/emailTemplates";
import {
  buildOutcomeReminderAlerts,
  buildWatchlistDueSoonAlerts,
  type UserAlertCandidate
} from "@/src/lib/alerts";
import type { OutcomeReminderDecision } from "@/src/lib/outcomeReminder";

export const runtime = "nodejs";

const MAX_USERS_PER_RUN = 100;
const MAX_EMAILS_PER_RUN = 50;

type AlertLink = {
  href: string;
  label: string;
};

type DecisionRow = {
  id: string;
  user_id: string;
  judgment_card_id: string;
  episode_id: string;
  topic_title: string;
  frame_type: string | null;
  genre: string | null;
  decision_type: "use_now" | "watch" | "skip";
  outcome: "success" | "regret" | "neutral" | null;
  created_at: string;
  deadline_at: string | null;
};

type WatchlistRow = {
  id: string;
  user_id: string;
  judgment_card_id: string;
  episode_id: string;
  topic_title: string;
  deadline_at: string | null;
  created_at: string;
  status: "saved" | "watching" | "archived";
  history_decision_id: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
};

type NotificationPreferencesRow = {
  user_id: string;
  weekly_digest_enabled: boolean;
  deadline_alert_enabled: boolean;
  outcome_reminder_enabled: boolean;
};

type AlertType = "deadline_due_soon" | "outcome_reminder" | "weekly_digest_ready" | "watchlist_due_soon";
type AlertSourceKind = "judgment_card" | "user_decision" | "weekly_digest";
type AlertUrgency = "critical" | "high" | "medium" | "low";

type StoredAlertForEmail = {
  id: string;
  userId: string;
  alertType: AlertType;
  alertTypeLabel: string;
  sourceId: string;
  sourceKind: AlertSourceKind;
  episodeId: string | null;
  title: string;
  summary: string;
  urgency: AlertUrgency;
  dueAt: string | null;
  isRead: boolean;
  isSent: boolean;
  createdAt: string;
  updatedAt: string;
  judgmentCardId: string | null;
  userDecisionId: string | null;
  previewLimited: boolean;
  links: AlertLink[];
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

  // Step 1: Find users with unresolved decisions (outcome = null)
  const { data: decisionRows, error: decisionError } = await supabase
    .from("user_decisions")
    .select("id, user_id, judgment_card_id, episode_id, topic_title, frame_type, genre, decision_type, outcome, created_at, deadline_at")
    .is("outcome", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (decisionError) {
    return jsonResponse({ ok: false, error: decisionError.message }, 500);
  }

  const decisions = (decisionRows as DecisionRow[] | null) ?? [];

  // Step 2: Find watchlist items with upcoming deadlines
  const { data: watchlistRows, error: watchlistError } = await supabase
    .from("user_watchlist_items")
    .select("id, user_id, judgment_card_id, episode_id, topic_title, deadline_at, created_at, status, history_decision_id")
    .in("status", ["saved", "watching"])
    .not("deadline_at", "is", null)
    .order("deadline_at", { ascending: true })
    .limit(300);

  if (watchlistError) {
    return jsonResponse({ ok: false, error: watchlistError.message }, 500);
  }

  const watchlistItems = (watchlistRows as WatchlistRow[] | null) ?? [];

  // Collect unique user IDs
  const userIds = [
    ...new Set([
      ...decisions.map((d) => d.user_id),
      ...watchlistItems.map((w) => w.user_id)
    ])
  ].slice(0, MAX_USERS_PER_RUN);

  if (userIds.length === 0) {
    return jsonResponse({ ok: true, generated: 0, sent: 0, skipped: 0, failed: 0 });
  }

  // Step 3: Fetch user emails
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

  // Step 4: Fetch notification preferences
  const { data: prefRows, error: prefError } = await supabase
    .from("user_notification_preferences")
    .select("user_id, weekly_digest_enabled, deadline_alert_enabled, outcome_reminder_enabled")
    .in("user_id", userIds);

  if (prefError) {
    return jsonResponse({ ok: false, error: prefError.message }, 500);
  }

  const prefsByUserId = new Map<string, NotificationPreferencesRow>();
  for (const row of (prefRows as NotificationPreferencesRow[] | null) ?? []) {
    prefsByUserId.set(row.user_id, row);
  }

  // Step 5: Generate alert candidates per user
  const now = new Date();
  const allCandidates: (UserAlertCandidate & { _userId: string })[] = [];

  // Group decisions by user
  const decisionsByUser = new Map<string, DecisionRow[]>();
  for (const decision of decisions) {
    const list = decisionsByUser.get(decision.user_id) ?? [];
    list.push(decision);
    decisionsByUser.set(decision.user_id, list);
  }

  // Group watchlist by user
  const watchlistByUser = new Map<string, WatchlistRow[]>();
  for (const item of watchlistItems) {
    const list = watchlistByUser.get(item.user_id) ?? [];
    list.push(item);
    watchlistByUser.set(item.user_id, list);
  }

  for (const userId of userIds) {
    const prefs = prefsByUserId.get(userId);

    // Generate outcome reminder alerts
    if (prefs?.outcome_reminder_enabled !== false) {
      const userDecisions = decisionsByUser.get(userId) ?? [];
      const outcomeDecisions: OutcomeReminderDecision[] = userDecisions.map((d) => ({
        id: d.id,
        judgment_card_id: d.judgment_card_id,
        episode_id: d.episode_id,
        topic_title: d.topic_title,
        frame_type: d.frame_type,
        genre: d.genre,
        decision_type: d.decision_type,
        outcome: d.outcome,
        created_at: d.created_at,
        deadline_at: d.deadline_at
      }));

      const reminderAlerts = buildOutcomeReminderAlerts(userId, outcomeDecisions, { now });
      for (const alert of reminderAlerts) {
        allCandidates.push({ ...alert, _userId: userId });
      }
    }

    // Generate watchlist due soon alerts
    if (prefs?.deadline_alert_enabled !== false) {
      const userWatchlist = watchlistByUser.get(userId) ?? [];
      const watchlistForAlerts = userWatchlist.map((w) => ({
        id: w.id,
        judgment_card_id: w.judgment_card_id,
        episode_id: w.episode_id,
        topic_title: w.topic_title,
        deadline_at: w.deadline_at,
        created_at: w.created_at,
        status: w.status,
        history_decision_id: w.history_decision_id
      }));

      const watchlistAlerts = buildWatchlistDueSoonAlerts(userId, watchlistForAlerts, { now });
      for (const alert of watchlistAlerts) {
        allCandidates.push({ ...alert, _userId: userId });
      }
    }
  }

  if (allCandidates.length === 0) {
    return jsonResponse({ ok: true, generated: 0, sent: 0, skipped: 0, failed: 0 });
  }

  // Step 6: Upsert alerts into user_alerts table
  const nowISO = now.toISOString();
  const upsertRows = allCandidates.map((candidate) => ({
    user_id: candidate.user_id,
    alert_type: candidate.alert_type,
    source_id: candidate.source_id,
    source_kind: candidate.source_kind,
    episode_id: candidate.episode_id,
    title: candidate.title,
    summary: candidate.summary,
    urgency: candidate.urgency,
    due_at: candidate.due_at,
    is_read: false,
    is_sent: false,
    dismissed_at: null,
    alert_payload: candidate.metadata,
    created_at: nowISO,
    updated_at: nowISO
  }));

  const { error: upsertError } = await supabase.from("user_alerts").upsert(upsertRows, {
    onConflict: "user_id,alert_type,source_kind,source_id",
    ignoreDuplicates: true
  });

  if (upsertError) {
    return jsonResponse({ ok: false, error: upsertError.message }, 500);
  }

  const generated = upsertRows.length;

  // Step 7: Send unsent alerts via email
  const { data: unsentRows, error: unsentError } = await supabase
    .from("user_alerts")
    .select(
      "id, user_id, alert_type, source_id, source_kind, episode_id, title, summary, urgency, due_at, is_read, is_sent, dismissed_at, created_at, updated_at, alert_payload"
    )
    .eq("is_sent", false)
    .is("dismissed_at", null)
    .in("alert_type", ["outcome_reminder", "watchlist_due_soon"])
    .order("created_at", { ascending: true })
    .limit(MAX_EMAILS_PER_RUN);

  if (unsentError) {
    return jsonResponse({ ok: true, generated, sent: 0, skipped: 0, failed: 0, warning: unsentError.message });
  }

  type AlertRow = {
    id: string;
    user_id: string;
    alert_type: string;
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

  const unsentAlerts = (unsentRows as AlertRow[] | null) ?? [];

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const sentIds: string[] = [];

  for (const alertRow of unsentAlerts) {
    const email = emailByUserId.get(alertRow.user_id);
    if (!email) {
      skipped++;
      continue;
    }

    const payload = alertRow.alert_payload ?? {};
    const links = Array.isArray(payload.links) ? payload.links.filter(isAlertLink) : [];

    const storedAlert: StoredAlertForEmail = {
      id: alertRow.id,
      userId: alertRow.user_id,
      alertType: alertRow.alert_type as AlertType,
      alertTypeLabel: ALERT_TYPE_LABELS[alertRow.alert_type] ?? alertRow.alert_type,
      sourceId: alertRow.source_id,
      sourceKind: alertRow.source_kind as AlertSourceKind,
      episodeId: alertRow.episode_id,
      title: alertRow.title,
      summary: alertRow.summary,
      urgency: alertRow.urgency as AlertUrgency,
      dueAt: alertRow.due_at,
      isRead: alertRow.is_read,
      isSent: alertRow.is_sent,
      createdAt: alertRow.created_at,
      updatedAt: alertRow.updated_at,
      judgmentCardId: typeof payload.judgment_card_id === "string" ? payload.judgment_card_id : null,
      userDecisionId: typeof payload.user_decision_id === "string" ? payload.user_decision_id : null,
      previewLimited: Boolean(payload.preview_limited),
      links
    };

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

  // Mark sent alerts
  if (sentIds.length > 0) {
    await supabase
      .from("user_alerts")
      .update({ is_sent: true })
      .in("id", sentIds);
  }

  return jsonResponse({ ok: true, generated, sent, skipped, failed });
}
