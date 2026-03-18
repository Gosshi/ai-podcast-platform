import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { sendEmail } from "@/app/lib/email";
import { buildAlertEmail } from "@/app/lib/emailTemplates";
import {
  buildWeeklyDigestReadyAlerts,
  type AlertWeeklyDigest,
  type UserAlertCandidate
} from "@/src/lib/alerts";
import { buildWeeklyDecisionDigest } from "@/src/lib/weeklyDecisionDigest";
import type { JudgmentType } from "@/src/lib/judgmentCards";

export const runtime = "nodejs";

const MAX_EMAILS_PER_RUN = 50;

type AlertLink = {
  href: string;
  label: string;
};

type AlertType = "deadline_due_soon" | "outcome_reminder" | "weekly_digest_ready" | "watchlist_due_soon";
type AlertSourceKind = "judgment_card" | "user_decision" | "weekly_digest";
type AlertUrgency = "critical" | "high" | "medium" | "low";

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

type SubscriptionRow = {
  user_id: string;
  status: string;
};

type JoinedEpisodeRow = {
  id: string;
  title: string | null;
  lang: "ja" | "en";
  genre: string | null;
  status: string;
  published_at: string | null;
};

type JudgmentCardRow = {
  id: string;
  episode_id: string;
  topic_title: string;
  judgment_type: JudgmentType;
  judgment_summary: string;
  deadline_at: string | null;
  genre: string | null;
  frame_type: string | null;
  created_at: string;
  episodes: JoinedEpisodeRow | JoinedEpisodeRow[] | null;
};

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

const PAID_STATUSES = new Set(["trialing", "active", "past_due"]);

const isAlertLink = (value: unknown): value is AlertLink => {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as AlertLink).href === "string" &&
      typeof (value as AlertLink).label === "string"
  );
};

const resolveJoinedEpisode = (
  value: JoinedEpisodeRow | JoinedEpisodeRow[] | null
): JoinedEpisodeRow | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

export async function POST(request: Request) {
  // Authenticate via CRON_SECRET (timing-safe comparison)
  const { verifyCronSecret } = await import("@/app/lib/cronAuth");
  const cronAuth = verifyCronSecret(request);
  if (!cronAuth.ok) {
    return jsonResponse({ ok: false, error: cronAuth.error }, cronAuth.status);
  }

  const supabase = createServiceRoleClient();

  // Step 1: Load this week's judgment cards (global, published in last 7 days)
  const now = new Date();
  const windowEnd = now;
  const windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: cardRows, error: cardError } = await supabase
    .from("episode_judgment_cards")
    .select(
      "id, episode_id, topic_title, judgment_type, judgment_summary, deadline_at, genre, frame_type, created_at, episodes!inner(id, title, lang, genre, status, published_at)"
    )
    .eq("episodes.status", "published")
    .gte("episodes.published_at", windowStart.toISOString())
    .lte("episodes.published_at", windowEnd.toISOString())
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(120);

  if (cardError) {
    return jsonResponse({ ok: false, error: cardError.message }, 500);
  }

  const cards = ((cardRows as JudgmentCardRow[] | null) ?? [])
    .map((row) => {
      const episode = resolveJoinedEpisode(row.episodes);
      if (!episode) return null;

      return {
        id: row.id,
        episode_id: row.episode_id,
        episode_title: episode.title,
        episode_published_at: episode.published_at,
        topic_title: row.topic_title,
        judgment_type: row.judgment_type,
        judgment_summary: row.judgment_summary,
        deadline_at: row.deadline_at,
        genre: row.genre ?? episode.genre,
        frame_type: row.frame_type,
        created_at: row.created_at
      };
    })
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  if (cards.length === 0) {
    return jsonResponse({ ok: true, generated: 0, sent: 0, skipped: 0, failed: 0, reason: "no_cards_this_week" });
  }

  // Build digest summary
  const digestSummary = buildWeeklyDecisionDigest(cards, null);
  const totalCards = digestSummary.counts.use_now + digestSummary.counts.watch + digestSummary.counts.skip;

  if (totalCards === 0) {
    return jsonResponse({ ok: true, generated: 0, sent: 0, skipped: 0, failed: 0, reason: "empty_digest" });
  }

  // Step 2: Find all users who have weekly_digest_enabled
  const { data: prefRows, error: prefError } = await supabase
    .from("user_notification_preferences")
    .select("user_id, weekly_digest_enabled, deadline_alert_enabled, outcome_reminder_enabled")
    .eq("weekly_digest_enabled", true);

  if (prefError) {
    return jsonResponse({ ok: false, error: prefError.message }, 500);
  }

  const eligiblePrefs = (prefRows as NotificationPreferencesRow[] | null) ?? [];

  // Also include users without preferences (default is enabled)
  const { data: allProfileRows, error: allProfileError } = await supabase
    .from("profiles")
    .select("id, email")
    .not("email", "is", null);

  if (allProfileError) {
    return jsonResponse({ ok: false, error: allProfileError.message }, 500);
  }

  const profiles = (allProfileRows as ProfileRow[] | null) ?? [];
  const emailByUserId = new Map<string, string>();
  for (const profile of profiles) {
    if (profile.email) {
      emailByUserId.set(profile.id, profile.email);
    }
  }

  // Users who explicitly opted out
  const { data: optOutRows } = await supabase
    .from("user_notification_preferences")
    .select("user_id")
    .eq("weekly_digest_enabled", false);

  const optedOutUserIds = new Set(
    ((optOutRows as { user_id: string }[] | null) ?? []).map((r) => r.user_id)
  );

  // Eligible users = all with email - opted out
  const eligibleUserIds = [...emailByUserId.keys()].filter((id) => !optedOutUserIds.has(id));

  if (eligibleUserIds.length === 0) {
    return jsonResponse({ ok: true, generated: 0, sent: 0, skipped: 0, failed: 0, reason: "no_eligible_users" });
  }

  // Step 3: Check subscription status for each user
  const { data: subRows } = await supabase
    .from("subscriptions")
    .select("user_id, status")
    .in("user_id", eligibleUserIds);

  const paidUserIds = new Set(
    ((subRows as SubscriptionRow[] | null) ?? [])
      .filter((s) => PAID_STATUSES.has(s.status))
      .map((s) => s.user_id)
  );

  // Step 4: Generate weekly_digest_ready alerts per user
  const nowISO = now.toISOString();
  const allAlertRows: {
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
    dismissed_at: null;
    alert_payload: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }[] = [];

  for (const userId of eligibleUserIds) {
    const isPaid = paidUserIds.has(userId);
    const digest: AlertWeeklyDigest = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      counts: digestSummary.counts,
      previewLimited: !isPaid && digestSummary.previewLimited
    };

    const alerts = buildWeeklyDigestReadyAlerts(userId, digest, { isPaid, now });
    for (const alert of alerts) {
      allAlertRows.push({
        user_id: alert.user_id,
        alert_type: alert.alert_type,
        source_id: alert.source_id,
        source_kind: alert.source_kind,
        episode_id: alert.episode_id,
        title: alert.title,
        summary: alert.summary,
        urgency: alert.urgency,
        due_at: alert.due_at,
        is_read: false,
        is_sent: false,
        dismissed_at: null,
        alert_payload: alert.metadata,
        created_at: nowISO,
        updated_at: nowISO
      });
    }
  }

  if (allAlertRows.length === 0) {
    return jsonResponse({ ok: true, generated: 0, sent: 0, skipped: 0, failed: 0 });
  }

  // Step 5: Upsert alerts
  const { error: upsertError } = await supabase.from("user_alerts").upsert(allAlertRows, {
    onConflict: "user_id,alert_type,source_kind,source_id",
    ignoreDuplicates: true
  });

  if (upsertError) {
    return jsonResponse({ ok: false, error: upsertError.message }, 500);
  }

  const generated = allAlertRows.length;

  // Step 6: Send unsent weekly_digest_ready alerts
  const { data: unsentRows, error: unsentError } = await supabase
    .from("user_alerts")
    .select(
      "id, user_id, alert_type, source_id, source_kind, episode_id, title, summary, urgency, due_at, is_read, is_sent, dismissed_at, created_at, updated_at, alert_payload"
    )
    .eq("is_sent", false)
    .is("dismissed_at", null)
    .eq("alert_type", "weekly_digest_ready")
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

  return jsonResponse({ ok: true, generated, sent, skipped, failed, totalCards });
}
