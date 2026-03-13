import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDecisionLibraryFilters,
  lockDecisionLibraryCardDetails,
  resolveDecisionLibraryUrgency,
  sortDecisionLibraryCards
} from "../src/lib/decisionLibrary.ts";

const now = new Date("2026-03-13T00:00:00.000Z");

const cards = [
  {
    id: "card-1",
    episode_id: "episode-1",
    episode_title: "Episode 1",
    episode_published_at: "2026-03-12T00:00:00.000Z",
    topic_title: "Netflix料金を今月切り替えるべきか",
    judgment_type: "use_now" as const,
    judgment_summary: "今月中に低価格プランへ切り替える。",
    action_text: "今日中にプラン変更を実行する",
    deadline_at: "2026-03-14T00:00:00.000Z",
    threshold_json: {},
    watch_points: ["広告時間", "画質差"],
    frame_type: "Frame A",
    genre: "entertainment",
    created_at: "2026-03-12T00:00:00.000Z",
    urgency: "due_soon" as const
  },
  {
    id: "card-2",
    episode_id: "episode-2",
    episode_title: "Episode 2",
    episode_published_at: "2026-03-11T00:00:00.000Z",
    topic_title: "AIノートアプリを監視する",
    judgment_type: "watch" as const,
    judgment_summary: "機能追加が揃うまで比較を続ける。",
    action_text: "来週まで価格改定を待つ",
    deadline_at: null,
    threshold_json: {},
    watch_points: ["検索速度"],
    frame_type: "Frame B",
    genre: "tech",
    created_at: "2026-03-11T00:00:00.000Z",
    urgency: "no_deadline" as const
  },
  {
    id: "card-3",
    episode_id: "episode-3",
    episode_title: "Episode 3",
    episode_published_at: "2026-03-10T00:00:00.000Z",
    topic_title: "動画サブスクは今回は見送る",
    judgment_type: "skip" as const,
    judgment_summary: "キャンペーン終了済みなので今回は見送る。",
    action_text: null,
    deadline_at: "2026-03-12T00:00:00.000Z",
    threshold_json: {},
    watch_points: ["再値下げ"],
    frame_type: "Frame C",
    genre: "entertainment",
    created_at: "2026-03-10T00:00:00.000Z",
    urgency: "overdue" as const
  }
];

test("resolveDecisionLibraryUrgency classifies overdue, due soon, and no deadline", () => {
  assert.equal(resolveDecisionLibraryUrgency("2026-03-12T23:59:00.000Z", now), "overdue");
  assert.equal(resolveDecisionLibraryUrgency("2026-03-14T00:00:00.000Z", now), "due_soon");
  assert.equal(resolveDecisionLibraryUrgency(null, now), "no_deadline");
});

test("applyDecisionLibraryFilters searches topic_title and summary and applies filters", () => {
  const filtered = applyDecisionLibraryFilters(
    cards,
    {
      query: "比較",
      genre: "tech",
      frameType: "Frame B",
      judgmentType: "watch",
      urgency: "no_deadline",
      sort: "newest"
    },
    now
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "card-2");
});

test("sortDecisionLibraryCards supports newest, deadline_soon, and judgment_priority", () => {
  assert.deepEqual(
    sortDecisionLibraryCards(cards, "newest", now).map((card) => card.id),
    ["card-1", "card-2", "card-3"]
  );
  assert.deepEqual(
    sortDecisionLibraryCards(cards, "deadline_soon", now).map((card) => card.id),
    ["card-3", "card-1", "card-2"]
  );
  assert.deepEqual(
    sortDecisionLibraryCards(cards, "judgment_priority", now).map((card) => card.id),
    ["card-1", "card-2", "card-3"]
  );
});

test("lockDecisionLibraryCardDetails strips paid-only details while preserving urgency", () => {
  const freeCard = lockDecisionLibraryCardDetails(cards[0]!);

  assert.equal(freeCard.action_text, null);
  assert.equal(freeCard.deadline_at, null);
  assert.deepEqual(freeCard.watch_points, []);
  assert.equal(freeCard.urgency, "due_soon");

  assert.equal(cards[0]?.action_text, "今日中にプラン変更を実行する");
  assert.equal(cards[0]?.deadline_at, "2026-03-14T00:00:00.000Z");
  assert.deepEqual(cards[0]?.watch_points, ["広告時間", "画質差"]);
});
