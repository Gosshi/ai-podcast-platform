import assert from "node:assert/strict";
import test from "node:test";
import {
  groupDecisionDashboardCards,
  pickTodayDecisionCards,
  sortDecisionDashboardCards
} from "../src/lib/decisionDashboard.ts";

test("sortDecisionDashboardCards prioritizes deadline, recency, then use_now", () => {
  const sorted = sortDecisionDashboardCards([
    {
      id: "watch-new",
      judgment_type: "watch",
      deadline_at: null,
      created_at: "2026-03-10T10:00:00.000Z",
      episode_published_at: "2026-03-10T10:00:00.000Z"
    },
    {
      id: "skip-soon",
      judgment_type: "skip",
      deadline_at: "2026-03-12T00:00:00.000Z",
      created_at: "2026-03-09T10:00:00.000Z",
      episode_published_at: "2026-03-09T10:00:00.000Z"
    },
    {
      id: "use-now-same-recency",
      judgment_type: "use_now",
      deadline_at: null,
      created_at: "2026-03-10T10:00:00.000Z",
      episode_published_at: "2026-03-10T10:00:00.000Z"
    }
  ]);

  assert.deepEqual(
    sorted.map((card) => card.id),
    ["skip-soon", "use-now-same-recency", "watch-new"]
  );
});

test("groupDecisionDashboardCards splits cards by judgment type", () => {
  const grouped = groupDecisionDashboardCards([
    { id: "1", judgment_type: "use_now" as const },
    { id: "2", judgment_type: "watch" as const },
    { id: "3", judgment_type: "watch" as const },
    { id: "4", judgment_type: "skip" as const }
  ]);

  assert.equal(grouped.use_now.length, 1);
  assert.equal(grouped.watch.length, 2);
  assert.equal(grouped.skip.length, 1);
});

test("pickTodayDecisionCards keeps only the newest decision day bucket", () => {
  const todayCards = pickTodayDecisionCards(
    [
      {
        id: "latest-a",
        judgment_type: "use_now",
        deadline_at: null,
        created_at: "2026-03-12T02:00:00.000Z",
        episode_published_at: "2026-03-12T02:00:00.000Z"
      },
      {
        id: "latest-b",
        judgment_type: "watch",
        deadline_at: null,
        created_at: "2026-03-12T01:00:00.000Z",
        episode_published_at: "2026-03-12T01:00:00.000Z"
      },
      {
        id: "older",
        judgment_type: "skip",
        deadline_at: null,
        created_at: "2026-03-10T01:00:00.000Z",
        episode_published_at: "2026-03-10T01:00:00.000Z"
      }
    ],
    "UTC"
  );

  assert.deepEqual(
    todayCards.map((card) => card.id),
    ["latest-a", "latest-b"]
  );
});
