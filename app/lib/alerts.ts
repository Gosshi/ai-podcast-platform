import {
  ALERT_TYPE_LABELS,
  buildUserAlertCandidates,
  type AlertLink,
  type AlertMetadata,
  type AlertSourceKind,
  type AlertType,
  type AlertUrgency,
  type UserNotificationPreferences
} from "@/src/lib/alerts";
import type { ViewerState } from "./viewer";
import { loadDecisionDashboardCards } from "./decisions";
import { loadDecisionHistory } from "./decisionHistory";
import { createServiceRoleClient } from "./supabaseClients";
import { loadUserNotificationPreferences } from "./userNotificationPreferences";
import { loadUserWatchlist } from "./watchlist";
import { loadWeeklyDecisionDigest } from "./weeklyDecisionDigest";

type UserAlertRow = {
  id: string;
  user_id: string;
  alert_type: AlertType;
  source_id: string;
  source_kind: AlertSourceKind;
  episode_id: string | null;
  title: string;
  summary: string;
  urgency: AlertUrgency;
  due_at: string | null;
  is_read: boolean;
  is_sent: boolean;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
  alert_payload: AlertMetadata | null;
};

type UpsertableUserAlertRow = {
  user_id: string;
  alert_type: AlertType;
  source_id: string;
  source_kind: AlertSourceKind;
  episode_id: string | null;
  title: string;
  summary: string;
  urgency: AlertUrgency;
  due_at: string | null;
  is_read: boolean;
  is_sent: boolean;
  dismissed_at: string | null;
  alert_payload: AlertMetadata;
  created_at: string;
  updated_at: string;
};

const USER_ALERTS_SELECT =
  "id, user_id, alert_type, source_id, source_kind, episode_id, title, summary, urgency, due_at, is_read, is_sent, dismissed_at, created_at, updated_at, alert_payload";

const buildAlertKey = (row: Pick<UserAlertRow, "alert_type" | "source_kind" | "source_id">): string => {
  return `${row.alert_type}::${row.source_kind}::${row.source_id}`;
};

const isAlertLink = (value: unknown): value is AlertLink => {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as AlertLink).href === "string" &&
      typeof (value as AlertLink).label === "string"
  );
};

const normalizeAlertMetadata = (value: AlertMetadata | null | undefined): AlertMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return {
    judgment_card_id: typeof value.judgment_card_id === "string" ? value.judgment_card_id : null,
    user_decision_id: typeof value.user_decision_id === "string" ? value.user_decision_id : null,
    preview_limited: Boolean(value.preview_limited),
    window_start: typeof value.window_start === "string" ? value.window_start : undefined,
    window_end: typeof value.window_end === "string" ? value.window_end : undefined,
    links: Array.isArray(value.links) ? value.links.filter(isAlertLink) : []
  };
};

const toStoredAlert = (row: UserAlertRow) => {
  const metadata = normalizeAlertMetadata(row.alert_payload);

  return {
    id: row.id,
    userId: row.user_id,
    alertType: row.alert_type,
    alertTypeLabel: ALERT_TYPE_LABELS[row.alert_type],
    sourceId: row.source_id,
    sourceKind: row.source_kind,
    episodeId: row.episode_id,
    title: row.title,
    summary: row.summary,
    urgency: row.urgency,
    dueAt: row.due_at,
    isRead: row.is_read,
    isSent: row.is_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    judgmentCardId: metadata.judgment_card_id ?? null,
    userDecisionId: metadata.user_decision_id ?? null,
    previewLimited: Boolean(metadata.preview_limited),
    links: metadata.links ?? []
  };
};

export type StoredUserAlert = ReturnType<typeof toStoredAlert>;

export const loadUserAlerts = async (
  userId: string
): Promise<{ alerts: StoredUserAlert[]; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_alerts")
      .select(USER_ALERTS_SELECT)
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .order("is_read", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return {
        alerts: [],
        error: error.message
      };
    }

    return {
      alerts: ((data as UserAlertRow[] | null) ?? []).map(toStoredAlert),
      error: null
    };
  } catch (error) {
    return {
      alerts: [],
      error: error instanceof Error ? error.message : "user_alerts_load_failed"
    };
  }
};

export const syncUserAlerts = async (
  viewer: ViewerState
): Promise<{
  alerts: StoredUserAlert[];
  preferences: UserNotificationPreferences;
  error: string | null;
}> => {
  const [decisionCardsState, historyState, watchlistState, weeklyDigestState, notificationPreferencesState] =
    await Promise.all([
      loadDecisionDashboardCards({ isPaid: true, userId: viewer.userId }),
      loadDecisionHistory(viewer.userId),
      loadUserWatchlist({
        userId: viewer.userId,
        filters: {
          status: null,
          genre: null,
          frameType: null,
          urgency: null,
          sort: "newest"
        }
      }),
      loadWeeklyDecisionDigest({ isPaid: viewer.isPaid }),
      loadUserNotificationPreferences(viewer.userId)
    ]);

  const preferences = notificationPreferencesState.preferences;
  const candidates = buildUserAlertCandidates({
    userId: viewer.userId,
    isPaid: viewer.isPaid,
    judgmentCards: decisionCardsState.cards.map((card) => ({
      id: card.id,
      episode_id: card.episode_id,
      topic_title: card.topic_title,
      judgment_type: card.judgment_type,
      deadline_at: card.ranking_deadline_at,
      created_at: card.created_at
    })),
    outcomeDecisions: historyState.entries.map((entry) => ({
      id: entry.id,
      judgment_card_id: entry.judgment_card_id,
      episode_id: entry.episode_id,
      topic_title: entry.topic_title,
      frame_type: entry.frame_type,
      genre: entry.genre,
      decision_type: entry.decision_type,
      outcome: entry.outcome,
      created_at: entry.created_at,
      deadline_at: entry.deadline_at
    })),
    watchlistItems: watchlistState.items.map((item) => ({
      id: item.id,
      judgment_card_id: item.judgment_card_id,
      episode_id: item.episode_id,
      topic_title: item.topic_title,
      deadline_at: item.deadline_at,
      created_at: item.created_at,
      history_decision_id: item.history_decision_id,
      status: item.status
    })),
    weeklyDigest: {
      windowStart: weeklyDigestState.digest.windowStart,
      windowEnd: weeklyDigestState.digest.windowEnd,
      counts: weeklyDigestState.digest.counts,
      previewLimited: weeklyDigestState.digest.previewLimited
    },
    notificationPreferences: preferences
  });

  try {
    const supabase = createServiceRoleClient();
    const { data: existingData, error: existingError } = await supabase
      .from("user_alerts")
      .select(USER_ALERTS_SELECT)
      .eq("user_id", viewer.userId);

    if (existingError) {
      return {
        alerts: [],
        preferences,
        error: existingError.message
      };
    }

    const existingRows = (existingData as UserAlertRow[] | null) ?? [];
    const existingByKey = existingRows.reduce((map, row) => {
      map.set(buildAlertKey(row), row);
      return map;
    }, new Map<string, UserAlertRow>());
    const candidateKeys = new Set(candidates.map(buildAlertKey));
    const staleIds = existingRows
      .filter((row) => row.dismissed_at === null)
      .filter((row) => !candidateKeys.has(buildAlertKey(row)))
      .map((row) => row.id);

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase.from("user_alerts").delete().in("id", staleIds);
      if (deleteError) {
        return {
          alerts: [],
          preferences,
          error: deleteError.message
        };
      }
    }

    if (candidates.length > 0) {
      const now = new Date().toISOString();
      const rowsToUpsert: UpsertableUserAlertRow[] = candidates.map((candidate) => {
        const existing = existingByKey.get(buildAlertKey(candidate));

        return {
          user_id: candidate.user_id,
          alert_type: candidate.alert_type,
          source_id: candidate.source_id,
          source_kind: candidate.source_kind,
          episode_id: candidate.episode_id,
          title: candidate.title,
          summary: candidate.summary,
          urgency: candidate.urgency,
          due_at: candidate.due_at,
          is_read: existing?.is_read ?? false,
          is_sent: existing?.is_sent ?? false,
          dismissed_at: existing?.dismissed_at ?? null,
          alert_payload: candidate.metadata,
          created_at: existing?.created_at ?? candidate.created_at,
          updated_at: now
        };
      });

      const { error: upsertError } = await supabase.from("user_alerts").upsert(rowsToUpsert, {
        onConflict: "user_id,alert_type,source_kind,source_id"
      });

      if (upsertError) {
        return {
          alerts: [],
          preferences,
          error: upsertError.message
        };
      }
    }

    const { alerts, error } = await loadUserAlerts(viewer.userId);
    return {
      alerts,
      preferences,
      error:
        error ??
        decisionCardsState.error ??
        historyState.error ??
        watchlistState.error ??
        weeklyDigestState.error ??
        notificationPreferencesState.error
    };
  } catch (error) {
    return {
      alerts: [],
      preferences,
      error: error instanceof Error ? error.message : "user_alerts_sync_failed"
    };
  }
};

export const updateUserAlertState = async (params: {
  userId: string;
  alertId: string;
  action: "read" | "unread" | "dismiss";
}): Promise<{ alert: StoredUserAlert | null; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const updates =
      params.action === "dismiss"
        ? {
            is_read: true,
            dismissed_at: new Date().toISOString()
          }
        : {
            is_read: params.action === "read"
          };

    const { data, error } = await supabase
      .from("user_alerts")
      .update(updates)
      .eq("id", params.alertId)
      .eq("user_id", params.userId)
      .select(USER_ALERTS_SELECT)
      .maybeSingle();

    if (error) {
      return {
        alert: null,
        error: error.message
      };
    }

    if (!data) {
      return {
        alert: null,
        error: "alert_not_found"
      };
    }

    return {
      alert: toStoredAlert(data as UserAlertRow),
      error: null
    };
  } catch (error) {
    return {
      alert: null,
      error: error instanceof Error ? error.message : "user_alert_update_failed"
    };
  }
};
