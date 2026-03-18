import type { JudgmentType } from "./judgmentCards.ts";
import {
  buildOutcomeReminderCandidates,
  formatOutcomeReminderTiming,
  type OutcomeReminderDecision
} from "./outcomeReminder.ts";

export const ALERT_TYPES = [
  "deadline_due_soon",
  "outcome_reminder",
  "weekly_digest_ready",
  "watchlist_due_soon"
] as const;

export const ALERT_SOURCE_KINDS = ["judgment_card", "user_decision", "weekly_digest"] as const;
export const ALERT_URGENCIES = ["critical", "high", "medium", "low"] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertSourceKind = (typeof ALERT_SOURCE_KINDS)[number];
export type AlertUrgency = (typeof ALERT_URGENCIES)[number];

export type UserNotificationPreferences = {
  weeklyDigestEnabled: boolean;
  deadlineAlertEnabled: boolean;
  outcomeReminderEnabled: boolean;
};

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  weeklyDigestEnabled: true,
  deadlineAlertEnabled: true,
  outcomeReminderEnabled: true
};

export type AlertLink = {
  href: string;
  label: string;
};

export type AlertMetadata = {
  judgment_card_id?: string | null;
  user_decision_id?: string | null;
  preview_limited?: boolean;
  window_start?: string;
  window_end?: string;
  links?: AlertLink[];
};

export type UserAlertCandidate = {
  user_id: string;
  alert_type: AlertType;
  source_id: string;
  source_kind: AlertSourceKind;
  judgment_card_id: string | null;
  user_decision_id: string | null;
  episode_id: string | null;
  title: string;
  summary: string;
  urgency: AlertUrgency;
  due_at: string | null;
  created_at: string;
  metadata: AlertMetadata;
};

export type AlertJudgmentCard = {
  id: string;
  episode_id: string;
  topic_title: string;
  judgment_type: JudgmentType;
  deadline_at: string | null;
  created_at: string;
};

export type AlertWatchlistItem = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  topic_title: string;
  deadline_at: string | null;
  created_at: string;
  history_decision_id: string | null;
  status: "saved" | "watching" | "archived";
};

export type AlertWeeklyDigest = {
  windowStart: string;
  windowEnd: string;
  counts: Record<JudgmentType, number>;
  previewLimited: boolean;
};

export const FREE_ALERT_LIMIT = 4;
export const PAID_ALERT_LIMIT = 12;
export const DEADLINE_DUE_SOON_WINDOW_HOURS = 72;
export const WATCHLIST_DUE_SOON_WINDOW_HOURS = 120;

const URGENCY_ORDER: Record<AlertUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const FREE_ALERT_TYPE_LIMITS: Record<AlertType, number> = {
  deadline_due_soon: 1,
  outcome_reminder: 1,
  weekly_digest_ready: 1,
  watchlist_due_soon: 1
};

const ALERT_TYPE_ORDER: Record<AlertType, number> = {
  deadline_due_soon: 0,
  watchlist_due_soon: 1,
  outcome_reminder: 2,
  weekly_digest_ready: 3
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return Number.POSITIVE_INFINITY;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const diffHours = (start: Date, end: Date): number => {
  return Math.floor((end.getTime() - start.getTime()) / (60 * 60 * 1000));
};

const resolveUrgencyFromHours = (hoursUntilDue: number): AlertUrgency => {
  if (hoursUntilDue <= 12) return "critical";
  if (hoursUntilDue <= 36) return "high";
  if (hoursUntilDue <= 72) return "medium";
  return "low";
};

const compareAlertCandidates = (left: UserAlertCandidate, right: UserAlertCandidate): number => {
  const urgencyComparison = URGENCY_ORDER[left.urgency] - URGENCY_ORDER[right.urgency];
  if (urgencyComparison !== 0) {
    return urgencyComparison;
  }

  const dueComparison = toTimestamp(left.due_at) - toTimestamp(right.due_at);
  if (dueComparison !== 0) {
    return dueComparison;
  }

  const typeComparison = ALERT_TYPE_ORDER[left.alert_type] - ALERT_TYPE_ORDER[right.alert_type];
  if (typeComparison !== 0) {
    return typeComparison;
  }

  return right.created_at.localeCompare(left.created_at);
};

const applyPlanLimits = (candidates: UserAlertCandidate[], isPaid: boolean): UserAlertCandidate[] => {
  if (isPaid) {
    return candidates.slice(0, PAID_ALERT_LIMIT);
  }

  const counts = {
    deadline_due_soon: 0,
    outcome_reminder: 0,
    weekly_digest_ready: 0,
    watchlist_due_soon: 0
  } satisfies Record<AlertType, number>;
  const limited: UserAlertCandidate[] = [];

  for (const candidate of candidates) {
    if (limited.length >= FREE_ALERT_LIMIT) {
      break;
    }

    if (counts[candidate.alert_type] >= FREE_ALERT_TYPE_LIMITS[candidate.alert_type]) {
      continue;
    }

    counts[candidate.alert_type] += 1;
    limited.push(candidate);
  }

  return limited;
};

export const buildWeeklyDigestAlertSourceId = (windowStart: string, windowEnd: string): string => {
  return `${windowStart}__${windowEnd}`;
};

export const buildDeadlineDueSoonAlerts = (
  userId: string,
  cards: AlertJudgmentCard[],
  options: {
    now?: Date;
    windowHours?: number;
  } = {}
): UserAlertCandidate[] => {
  const now = options.now ?? new Date();
  const windowHours = options.windowHours ?? DEADLINE_DUE_SOON_WINDOW_HOURS;
  const createdAt = now.toISOString();

  return cards
    .flatMap((card) => {
      const deadlineTimestamp = toTimestamp(card.deadline_at);
      if (!Number.isFinite(deadlineTimestamp)) {
        return [];
      }

      const deadlineDate = new Date(deadlineTimestamp);
      const hoursUntilDue = diffHours(now, deadlineDate);
      if (hoursUntilDue < 0 || hoursUntilDue > windowHours) {
        return [];
      }

      return [
        {
          user_id: userId,
          alert_type: "deadline_due_soon",
          source_id: card.id,
          source_kind: "judgment_card",
          judgment_card_id: card.id,
          user_decision_id: null,
          episode_id: card.episode_id,
          title: `${card.topic_title} の締切が近づいています`,
          summary:
            hoursUntilDue <= 24
              ? "24時間以内に確認したいトピックです。詳細から理由と次の行動を確認できます。"
              : `${hoursUntilDue}時間以内に見直したいトピックです。保存一覧や詳細から再訪できます。`,
          urgency: resolveUrgencyFromHours(hoursUntilDue),
          due_at: card.deadline_at,
          created_at: createdAt,
          metadata: {
            judgment_card_id: card.id,
            links: [
              { href: `/decisions/${card.episode_id}`, label: "詳細" }
            ]
          }
        } satisfies UserAlertCandidate
      ];
    })
    .sort(compareAlertCandidates);
};

export const buildWatchlistDueSoonAlerts = (
  userId: string,
  items: AlertWatchlistItem[],
  options: {
    now?: Date;
    windowHours?: number;
  } = {}
): UserAlertCandidate[] => {
  const now = options.now ?? new Date();
  const windowHours = options.windowHours ?? WATCHLIST_DUE_SOON_WINDOW_HOURS;
  const createdAt = now.toISOString();

  return items
    .flatMap((item) => {
      if (item.status === "archived") {
        return [];
      }

      const deadlineTimestamp = toTimestamp(item.deadline_at);
      if (!Number.isFinite(deadlineTimestamp)) {
        return [];
      }

      const deadlineDate = new Date(deadlineTimestamp);
      const hoursUntilDue = diffHours(now, deadlineDate);
      if (hoursUntilDue < 0 || hoursUntilDue > windowHours) {
        return [];
      }

        return [
        {
          user_id: userId,
          alert_type: "watchlist_due_soon",
          source_id: item.judgment_card_id,
          source_kind: "judgment_card",
          judgment_card_id: item.judgment_card_id,
          user_decision_id: item.history_decision_id,
          episode_id: item.episode_id,
          title: `保存中の「${item.topic_title}」を見直すタイミングです`,
          summary:
            item.status === "watching"
              ? "保存中のトピックです。期限前に詳細と保存一覧を見直してください。"
              : "保存したトピックです。期限が来る前に保存一覧から再訪してください。",
          urgency: resolveUrgencyFromHours(hoursUntilDue),
          due_at: item.deadline_at,
          created_at: createdAt,
          metadata: {
            judgment_card_id: item.judgment_card_id,
            user_decision_id: item.history_decision_id,
            links: [
              { href: `/decisions/${item.episode_id}`, label: "詳細" }
            ]
          }
        } satisfies UserAlertCandidate
      ];
    })
    .sort(compareAlertCandidates);
};

export const buildOutcomeReminderAlerts = (
  userId: string,
  decisions: OutcomeReminderDecision[],
  options: {
    now?: Date;
  } = {}
): UserAlertCandidate[] => {
  const now = options.now ?? new Date();
  const createdAt = now.toISOString();

  return buildOutcomeReminderCandidates(decisions, { now })
    .map(
      (candidate) =>
        ({
          user_id: userId,
          alert_type: "outcome_reminder",
          source_id: candidate.id,
          source_kind: "user_decision",
          judgment_card_id: candidate.judgment_card_id,
          user_decision_id: candidate.id,
          episode_id: candidate.episode_id,
          title: `${candidate.topic_title} の結果を記録してください`,
          summary: `${formatOutcomeReminderTiming(candidate)}。履歴や学び画面から見直せます。`,
          urgency:
            candidate.reason === "deadline_passed"
              ? candidate.days_past_deadline === 0
                ? "high"
                : "critical"
              : candidate.elapsed_days >= 7
                ? "high"
                : "medium",
          due_at: candidate.deadline_at ?? candidate.created_at,
          created_at: createdAt,
          metadata: {
            judgment_card_id: candidate.judgment_card_id,
            user_decision_id: candidate.id,
            links: [
              { href: `/history`, label: "履歴" },
              { href: `/decisions/${candidate.episode_id}`, label: "詳細" }
            ]
          }
        }) satisfies UserAlertCandidate
    )
    .sort(compareAlertCandidates);
};

export const buildWeeklyDigestReadyAlerts = (
  userId: string,
  digest: AlertWeeklyDigest | null,
  options: {
    isPaid: boolean;
    now?: Date;
  }
): UserAlertCandidate[] => {
  if (!digest) {
    return [];
  }

  const total = digest.counts.use_now + digest.counts.watch + digest.counts.skip;
  if (total === 0) {
    return [];
  }

  const now = options.now ?? new Date();
  const createdAt = now.toISOString();
  const title = options.isPaid
    ? `今週のまとめができました (${total}件)`
    : `今週のまとめプレビューができました (${total}件)`;

  return [
    {
      user_id: userId,
      alert_type: "weekly_digest_ready",
      source_id: buildWeeklyDigestAlertSourceId(digest.windowStart, digest.windowEnd),
      source_kind: "weekly_digest",
      judgment_card_id: null,
      user_decision_id: null,
      episode_id: null,
      title,
      summary: options.isPaid
        ? `採用 ${digest.counts.use_now} / 様子見 ${digest.counts.watch} / 見送り ${digest.counts.skip} を週まとめで確認できます。`
        : "無料版では一部プレビューまで表示します。有料版で全体を確認できます。",
      urgency: "low",
      due_at: digest.windowEnd,
      created_at: createdAt,
      metadata: {
        preview_limited: !options.isPaid || digest.previewLimited,
        window_start: digest.windowStart,
        window_end: digest.windowEnd,
        links: [
          { href: "/history", label: "履歴" },
          { href: "/decisions", label: "今日のエピソード" }
        ]
      }
    }
  ];
};

export const buildUserAlertCandidates = (params: {
  userId: string;
  isPaid: boolean;
  judgmentCards: AlertJudgmentCard[];
  outcomeDecisions: OutcomeReminderDecision[];
  watchlistItems: AlertWatchlistItem[];
  weeklyDigest: AlertWeeklyDigest | null;
  notificationPreferences?: UserNotificationPreferences | null;
  now?: Date;
}): UserAlertCandidate[] => {
  const preferences = params.notificationPreferences ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
  const now = params.now ?? new Date();
  const candidates: UserAlertCandidate[] = [];

  if (preferences.deadlineAlertEnabled) {
    candidates.push(
      ...buildDeadlineDueSoonAlerts(params.userId, params.judgmentCards, { now }),
      ...buildWatchlistDueSoonAlerts(params.userId, params.watchlistItems, { now })
    );
  }

  if (preferences.outcomeReminderEnabled) {
    candidates.push(...buildOutcomeReminderAlerts(params.userId, params.outcomeDecisions, { now }));
  }

  if (preferences.weeklyDigestEnabled) {
    candidates.push(...buildWeeklyDigestReadyAlerts(params.userId, params.weeklyDigest, { isPaid: params.isPaid, now }));
  }

  return applyPlanLimits(candidates.sort(compareAlertCandidates), params.isPaid);
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  deadline_due_soon: "期限あり",
  outcome_reminder: "結果の記録",
  weekly_digest_ready: "週ごとのまとめ",
  watchlist_due_soon: "保存済み"
};

export const ALERT_URGENCY_LABELS: Record<AlertUrgency, string> = {
  critical: "高",
  high: "やや高",
  medium: "通常",
  low: "あとで"
};
