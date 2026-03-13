export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "decisions_view",
  "episodes_view",
  "history_view",
  "weekly_digest_view",
  "account_view",
  "judgment_card_impression",
  "judgment_card_click",
  "judgment_card_expand",
  "judgment_card_locked_cta_click",
  "decision_calculator_open",
  "decision_calculator_submit",
  "decision_calculator_result_view",
  "decision_save",
  "decision_remove",
  "outcome_update",
  "next_best_decision_impression",
  "next_best_decision_click",
  "paywall_view",
  "subscribe_cta_click",
  "checkout_started",
  "checkout_completed",
  "billing_portal_open",
  "weekly_digest_open",
  "weekly_digest_item_click"
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_PAGE_NAMES = [
  "/decisions",
  "/episodes",
  "/history",
  "/weekly-decisions",
  "/account"
] as const;

export type AnalyticsPageName = (typeof ANALYTICS_PAGE_NAMES)[number];

export const isAnalyticsEventName = (value: unknown): value is AnalyticsEventName => {
  return typeof value === "string" && ANALYTICS_EVENT_NAMES.includes(value as AnalyticsEventName);
};

