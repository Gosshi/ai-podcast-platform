import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalyticsOverview } from "../src/lib/analytics/reporting.ts";
import { sanitizeAnalyticsProperties } from "../src/lib/analytics/shared.ts";

test("sanitizeAnalyticsProperties removes unsupported values and adds serializable shapes", () => {
  const sanitized = sanitizeAnalyticsProperties({
    page: "/decisions",
    count: 3,
    active: true,
    skip: undefined,
    invalid: Number.NaN,
    nested: {
      label: "  paid  ",
      fn: () => "noop"
    },
    list: [1, "two", undefined, { ok: true }]
  });

  assert.deepEqual(sanitized, {
    page: "/decisions",
    count: 3,
    active: true,
    nested: {
      label: "paid"
    },
    list: [1, "two", { ok: true }]
  });
});

test("buildAnalyticsOverview summarizes funnel, engagement, and page views", () => {
  const overview = buildAnalyticsOverview(
    [
      {
        anonymous_id: "anon-1",
        user_id: null,
        event_name: "page_view",
        page: "/decisions",
        source: "page",
        is_paid: false,
        created_at: "2026-03-13T00:00:00.000Z"
      },
      {
        anonymous_id: null,
        user_id: "user-1",
        event_name: "subscribe_cta_click",
        page: "/decisions",
        source: "paywall",
        is_paid: false,
        created_at: "2026-03-13T00:01:00.000Z"
      },
      {
        anonymous_id: null,
        user_id: "user-1",
        event_name: "checkout_started",
        page: "/decisions",
        source: "checkout",
        is_paid: false,
        created_at: "2026-03-13T00:02:00.000Z"
      },
      {
        anonymous_id: null,
        user_id: "user-1",
        event_name: "checkout_completed",
        page: null,
        source: "stripe_webhook",
        is_paid: true,
        created_at: "2026-03-13T00:03:00.000Z"
      },
      {
        anonymous_id: null,
        user_id: "user-1",
        event_name: "decision_save",
        page: "/decisions",
        source: "card",
        is_paid: true,
        created_at: "2026-03-13T00:04:00.000Z"
      },
      {
        anonymous_id: null,
        user_id: "user-1",
        event_name: "watchlist_add",
        page: "/watchlist",
        source: "watchlist_card",
        is_paid: false,
        created_at: "2026-03-13T00:04:30.000Z"
      },
      {
        anonymous_id: null,
        user_id: "user-1",
        event_name: "decision_replay_view",
        page: "/history/replay/decision-1",
        source: "page",
        is_paid: true,
        created_at: "2026-03-13T00:05:00.000Z"
      },
      {
        anonymous_id: null,
        user_id: "user-1",
        event_name: "outcome_quick_submit",
        page: "/history",
        source: "outcome_reminder_quick_submit",
        is_paid: false,
        created_at: "2026-03-13T00:06:00.000Z"
      }
    ],
    30
  );

  assert.equal(overview.totals.events, 8);
  assert.equal(overview.totals.anonymous, 1);
  assert.equal(overview.totals.free, 5);
  assert.equal(overview.totals.paid, 3);
  assert.equal(overview.pageViews[0]?.page, "/decisions");
  assert.equal(overview.pageViews[0]?.total, 1);
  assert.equal(overview.funnel.find((item) => item.eventName === "checkout_completed")?.paid, 1);
  assert.equal(overview.engagement.find((item) => item.eventName === "decision_save")?.paid, 1);
  assert.equal(overview.engagement.find((item) => item.eventName === "watchlist_add")?.free, 1);
  assert.equal(overview.engagement.find((item) => item.eventName === "decision_replay_view")?.paid, 1);
  assert.equal(overview.engagement.find((item) => item.eventName === "outcome_quick_submit")?.free, 1);
});
