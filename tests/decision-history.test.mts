import assert from "node:assert/strict";
import test from "node:test";
import {
  attachSavedDecisionState,
  calculateDecisionHistoryStats,
  formatDecisionHistoryDate,
  FREE_DECISION_HISTORY_LIMIT,
  hasReachedDecisionHistoryLimit
} from "../app/lib/decisionHistory.ts";

test("free decision history limit is enforced only for non-paid users", () => {
  assert.equal(FREE_DECISION_HISTORY_LIMIT, 10);
  assert.equal(hasReachedDecisionHistoryLimit(10, false), true);
  assert.equal(hasReachedDecisionHistoryLimit(9, false), false);
  assert.equal(hasReachedDecisionHistoryLimit(10, true), false);
});

test("decision history stats summarize outcomes", () => {
  assert.deepEqual(
    calculateDecisionHistoryStats([
      { outcome: "success" },
      { outcome: "success" },
      { outcome: "regret" },
      { outcome: "neutral" }
    ]),
    {
      totalDecisions: 4,
      successCount: 2,
      regretCount: 1,
      neutralCount: 1,
      successRate: 50
    }
  );
});

test("attachSavedDecisionState marks saved cards with their outcome", () => {
  const cards = attachSavedDecisionState(
    [
      {
        id: "card-1",
        topic_order: 1,
        topic_title: "料金見直し",
        frame_type: "Frame B",
        judgment_type: "use_now",
        judgment_summary: "今月中に切り替える",
        action_text: null,
        deadline_at: null,
        threshold_json: {},
        watch_points: [],
        confidence_score: null
      },
      {
        id: "card-2",
        topic_order: 2,
        topic_title: "契約継続",
        frame_type: null,
        judgment_type: "watch",
        judgment_summary: "来月まで様子を見る",
        action_text: null,
        deadline_at: null,
        threshold_json: {},
        watch_points: [],
        confidence_score: null
      }
    ],
    new Map([
      [
        "card-1",
        {
          id: "decision-1",
          judgment_card_id: "card-1",
          outcome: "success"
        }
      ]
    ])
  );

  assert.equal(cards[0]?.is_saved, true);
  assert.equal(cards[0]?.saved_decision_id, "decision-1");
  assert.equal(cards[0]?.saved_outcome, "success");
  assert.equal(cards[1]?.is_saved, false);
  assert.equal(cards[1]?.saved_decision_id, null);
});

test("formatDecisionHistoryDate returns localized dates", () => {
  assert.equal(formatDecisionHistoryDate("2026-03-13T00:00:00.000Z"), "2026年3月13日");
});
