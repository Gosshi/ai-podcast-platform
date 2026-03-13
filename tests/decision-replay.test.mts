import assert from "node:assert/strict";
import test from "node:test";
import { buildPersonalDecisionProfile } from "../src/lib/decisionProfile.ts";
import {
  buildDecisionReplayInsights,
  buildDecisionReplayPath,
  buildDecisionReplayView,
  formatDecisionReplayDateTime,
  type DecisionReplay
} from "../app/lib/decisionReplay.ts";

const createReplay = (overrides: Partial<DecisionReplay> = {}): DecisionReplay => ({
  id: "decision-1",
  judgment_card_id: "card-1",
  episode_id: "episode-1",
  topic_title: "動画サブスクを継続するか",
  genre: "entertainment",
  frame_type: "Frame B",
  judgment_type: "watch",
  decision_type: "watch",
  judgment_summary: "今月は比較を続けて、更新前に見直す。",
  action_text: "更新日前に代替候補を比較する。",
  deadline_at: "2026-03-20T00:00:00.000Z",
  watch_points: ["視聴時間が月8時間を下回るか", "広告負荷が増えたか"],
  threshold_json: {
    watch_time: [
      {
        raw: "月8時間",
        value: 8,
        unit: "hours"
      }
    ]
  },
  threshold_highlights: ["視聴時間: 月8時間"],
  created_at: "2026-03-13T00:00:00.000Z",
  outcome: "success",
  outcome_updated_at: "2026-03-18T00:00:00.000Z",
  episode_title: "Episode 1",
  episode_published_at: "2026-03-12T00:00:00.000Z",
  ...overrides
});

test("buildDecisionReplayPath returns replay route under history", () => {
  assert.equal(buildDecisionReplayPath("decision-123"), "/history/replay/decision-123");
});

test("buildDecisionReplayView keeps full fields for paid and hides detail fields for free", () => {
  const replay = createReplay();

  assert.equal(buildDecisionReplayView(replay, true).action_text, "更新日前に代替候補を比較する。");

  const preview = buildDecisionReplayView(replay, false);
  assert.equal(preview.action_text, null);
  assert.equal(preview.deadline_at, null);
  assert.deepEqual(preview.watch_points, []);
  assert.deepEqual(preview.threshold_json, {});
  assert.deepEqual(preview.threshold_highlights, []);
});

test("buildDecisionReplayInsights returns caution for regretful watch pattern", () => {
  const replay = createReplay({
    outcome: "regret",
    deadline_at: null,
    watch_points: [],
    threshold_json: {},
    threshold_highlights: []
  });
  const profile = buildPersonalDecisionProfile([
    {
      decision_type: "watch",
      outcome: "regret",
      frame_type: "Frame B",
      genre: "entertainment",
      threshold_json: {}
    },
    {
      decision_type: "watch",
      outcome: "regret",
      frame_type: "Frame B",
      genre: "entertainment",
      threshold_json: {}
    },
    {
      decision_type: "watch",
      outcome: "success",
      frame_type: "Frame B",
      genre: "entertainment",
      threshold_json: {}
    }
  ]);

  const insights = buildDecisionReplayInsights(replay, profile);
  assert.equal(insights.length > 0, true);
  assert.equal(insights.some((insight) => insight.title.includes("watch")), true);
  assert.equal(insights.some((insight) => insight.tone === "caution"), true);
});

test("buildDecisionReplayInsights falls back to data-light insight when history is sparse", () => {
  const replay = createReplay({
    outcome: "neutral"
  });
  const profile = buildPersonalDecisionProfile([
    {
      decision_type: "use_now",
      outcome: "neutral",
      frame_type: null,
      genre: null,
      threshold_json: {}
    }
  ]);

  assert.deepEqual(buildDecisionReplayInsights(replay, profile), [
    {
      key: "data-light",
      title: "まだ強い傾向は出ていません",
      body: "この replay は profile と recommendation を育てるための基礎データになります。履歴が増えるほど、より具体的な学びを返しやすくなります。",
      tone: "neutral"
    }
  ]);
});

test("buildDecisionReplayInsights asks for outcome when replay is still unresolved", () => {
  const replay = createReplay({
    outcome: null,
    outcome_updated_at: null
  });
  const profile = buildPersonalDecisionProfile([]);

  assert.deepEqual(buildDecisionReplayInsights(replay, profile), [
    {
      key: "outcome-pending",
      title: "まだ結果は記録されていません",
      body: "Outcome を残すと、この replay が profile learning と next best decision の改善に返り始めます。",
      tone: "neutral"
    }
  ]);
});

test("formatDecisionReplayDateTime returns localized date time", () => {
  assert.equal(formatDecisionReplayDateTime("2026-03-13T00:00:00.000Z"), "2026年3月13日 09:00");
});
