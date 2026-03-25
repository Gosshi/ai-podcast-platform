import type { AnalyticsEventName } from "./events";

export type AnalyticsEventRow = {
  anonymous_id: string | null;
  user_id: string | null;
  event_name: AnalyticsEventName;
  page: string | null;
  source: string | null;
  is_paid: boolean;
  created_at: string;
};

export type AnalyticsOverview = {
  windowDays: number;
  totals: {
    events: number;
    anonymousVisitors: number;
    freeVisitors: number;
    paidUsers: number;
  };
  funnel: Array<{
    eventName: AnalyticsEventName;
    label: string;
    total: number;
    free: number;
    paid: number;
  }>;
  engagement: Array<{
    eventName: AnalyticsEventName;
    label: string;
    total: number;
    free: number;
    paid: number;
  }>;
  pageViews: Array<{
    page: string;
    total: number;
  }>;
  topEvents: Array<{
    eventName: AnalyticsEventName;
    total: number;
    free: number;
    paid: number;
  }>;
};

const FUNNEL_DEFINITIONS: Array<{ eventName: AnalyticsEventName; label: string }> = [
  { eventName: "paywall_view", label: "Paywall Views" },
  { eventName: "subscribe_cta_click", label: "Subscribe CTA Clicks" },
  { eventName: "checkout_started", label: "Checkout Started" },
  { eventName: "checkout_completed", label: "Checkout Completed" }
];

const ENGAGEMENT_DEFINITIONS: Array<{ eventName: AnalyticsEventName; label: string }> = [
  { eventName: "page_view", label: "Page Views" },
  { eventName: "landing_view", label: "Landing Views" },
  { eventName: "landing_start_click", label: "Landing Start Clicks" },
  { eventName: "landing_cta_click", label: "Landing CTA Clicks" },
  { eventName: "onboarding_entry_click", label: "Onboarding Entry Clicks" },
  { eventName: "nav_click", label: "Navigation Clicks" },
  { eventName: "alerts_view", label: "Alerts Views" },
  { eventName: "decisions_intro_impression", label: "Decisions Intro Impressions" },
  { eventName: "decisions_hero_impression", label: "Decisions Hero Impressions" },
  { eventName: "onboarding_start", label: "Onboarding Starts" },
  { eventName: "onboarding_step_complete", label: "Onboarding Step Completions" },
  { eventName: "onboarding_complete", label: "Onboarding Completions" },
  { eventName: "preference_update", label: "Preference Updates" },
  { eventName: "judgment_card_impression", label: "Judgment Card Impressions" },
  { eventName: "judgment_card_click", label: "Judgment Card Clicks" },
  { eventName: "library_view", label: "Library Views" },
  { eventName: "watchlist_view", label: "Watchlist Views" },
  { eventName: "library_search", label: "Library Searches" },
  { eventName: "library_filter_change", label: "Library Filter Changes" },
  { eventName: "library_sort_change", label: "Library Sort Changes" },
  { eventName: "library_card_click", label: "Library Card Clicks" },
  { eventName: "library_pref_personalized_impression", label: "Library Personalized Impressions" },
  { eventName: "watchlist_add", label: "Watchlist Adds" },
  { eventName: "watchlist_remove", label: "Watchlist Removes" },
  { eventName: "watchlist_filter_change", label: "Watchlist Filter Changes" },
  { eventName: "watchlist_card_click", label: "Watchlist Card Clicks" },
  { eventName: "decision_calculator_result_view", label: "Calculator Results" },
  { eventName: "decision_save", label: "Decision Saves" },
  { eventName: "decision_action_click", label: "Decision Action Clicks" },
  { eventName: "outcome_reminder_impression", label: "Outcome Reminder Impressions" },
  { eventName: "outcome_reminder_click", label: "Outcome Reminder Clicks" },
  { eventName: "outcome_quick_submit", label: "Outcome Quick Submit" },
  { eventName: "outcome_reminder_to_replay_click", label: "Outcome Reminder Replay Clicks" },
  { eventName: "alert_impression", label: "Alert Impressions" },
  { eventName: "alert_click", label: "Alert Clicks" },
  { eventName: "alert_mark_read", label: "Alert Mark Read" },
  { eventName: "alert_dismiss", label: "Alert Dismiss" },
  { eventName: "weekly_digest_alert_click", label: "Weekly Digest Alert Clicks" },
  { eventName: "outcome_reminder_alert_click", label: "Outcome Reminder Alert Clicks" },
  { eventName: "decision_replay_from_history_click", label: "Replay Clicks From History" },
  { eventName: "decision_replay_view", label: "Replay Views" },
  { eventName: "decision_replay_insight_impression", label: "Replay Insight Impressions" },
  { eventName: "weekly_digest_open", label: "Weekly Digest Opens" },
  { eventName: "outcome_update", label: "Outcome Updates" }
];

const countByPlan = (rows: AnalyticsEventRow[], eventName: AnalyticsEventName) => {
  const filtered = rows.filter((row) => row.event_name === eventName);
  return {
    total: filtered.length,
    free: filtered.filter((row) => !row.is_paid).length,
    paid: filtered.filter((row) => row.is_paid).length
  };
};

const countUniqueAnonymousVisitors = (rows: AnalyticsEventRow[]): number => {
  const anonymousIds = new Set<string>();

  for (const row of rows) {
    if (!row.user_id && row.anonymous_id) {
      anonymousIds.add(row.anonymous_id);
    }
  }

  return anonymousIds.size;
};

const countUniqueFreeVisitors = (rows: AnalyticsEventRow[]): number => {
  const actorIds = new Set<string>();

  for (const row of rows) {
    if (row.is_paid) {
      continue;
    }

    if (row.user_id) {
      actorIds.add(`user:${row.user_id}`);
      continue;
    }

    if (row.anonymous_id) {
      actorIds.add(`anon:${row.anonymous_id}`);
    }
  }

  return actorIds.size;
};

const countUniquePaidUsers = (rows: AnalyticsEventRow[]): number => {
  const userIds = new Set<string>();

  for (const row of rows) {
    if (row.is_paid && row.user_id) {
      userIds.add(row.user_id);
    }
  }

  return userIds.size;
};

export const buildAnalyticsOverview = (
  rows: AnalyticsEventRow[],
  windowDays: number
): AnalyticsOverview => {
  const anonymousVisitors = countUniqueAnonymousVisitors(rows);
  const freeVisitors = countUniqueFreeVisitors(rows);
  const paidUsers = countUniquePaidUsers(rows);

  const pageViews = Array.from(
    rows
      .filter((row) => row.event_name === "page_view" && row.page)
      .reduce((map, row) => {
        const page = row.page ?? "unknown";
        map.set(page, (map.get(page) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .map(([page, total]) => ({ page, total }))
    .sort((a, b) => b.total - a.total);

  const topEvents = Array.from(
    rows.reduce((map, row) => {
      const current = map.get(row.event_name) ?? { total: 0, free: 0, paid: 0 };
      current.total += 1;
      if (row.is_paid) {
        current.paid += 1;
      } else {
        current.free += 1;
      }
      map.set(row.event_name, current);
      return map;
    }, new Map<AnalyticsEventName, { total: number; free: number; paid: number }>())
  )
    .map(([eventName, counts]) => ({ eventName, ...counts }))
    .sort((a, b) => b.total - a.total);

  return {
    windowDays,
    totals: {
      events: rows.length,
      anonymousVisitors,
      freeVisitors,
      paidUsers
    },
    funnel: FUNNEL_DEFINITIONS.map((definition) => ({
      eventName: definition.eventName,
      label: definition.label,
      ...countByPlan(rows, definition.eventName)
    })),
    engagement: ENGAGEMENT_DEFINITIONS.map((definition) => ({
      eventName: definition.eventName,
      label: definition.label,
      ...countByPlan(rows, definition.eventName)
    })),
    pageViews,
    topEvents
  };
};
