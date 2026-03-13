import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWatchlistFilters,
  FREE_WATCHLIST_LIMIT,
  hasReachedWatchlistLimit,
  resolveWatchlistUrgency,
  sortWatchlistItems
} from "../src/lib/watchlist.ts";

const now = new Date("2026-03-13T00:00:00.000Z");

const items = [
  {
    id: "watchlist-1",
    judgment_card_id: "card-1",
    episode_id: "episode-1",
    topic_title: "新しい動画AIをすぐ試すか",
    judgment_type: "use_now" as const,
    frame_type: "Frame A",
    genre: "tech",
    deadline_at: "2026-03-14T00:00:00.000Z",
    status: "saved" as const,
    created_at: "2026-03-12T00:00:00.000Z",
    updated_at: "2026-03-12T00:00:00.000Z"
  },
  {
    id: "watchlist-2",
    judgment_card_id: "card-2",
    episode_id: "episode-2",
    topic_title: "旅行サブスクの値下げを監視する",
    judgment_type: "watch" as const,
    frame_type: "Frame B",
    genre: "travel",
    deadline_at: null,
    status: "watching" as const,
    created_at: "2026-03-11T00:00:00.000Z",
    updated_at: "2026-03-11T00:00:00.000Z"
  },
  {
    id: "watchlist-3",
    judgment_card_id: "card-3",
    episode_id: "episode-3",
    topic_title: "価格改定が終わったので今回は閉じる",
    judgment_type: "skip" as const,
    frame_type: "Frame C",
    genre: "tech",
    deadline_at: "2026-03-12T00:00:00.000Z",
    status: "archived" as const,
    created_at: "2026-03-10T00:00:00.000Z",
    updated_at: "2026-03-10T00:00:00.000Z"
  }
];

test("resolveWatchlistUrgency classifies overdue, due soon, and no deadline", () => {
  assert.equal(resolveWatchlistUrgency("2026-03-12T23:00:00.000Z", now), "overdue");
  assert.equal(resolveWatchlistUrgency("2026-03-14T00:00:00.000Z", now), "due_soon");
  assert.equal(resolveWatchlistUrgency(null, now), "no_deadline");
});

test("applyWatchlistFilters supports status, genre, frame, and urgency filters", () => {
  const filtered = applyWatchlistFilters(
    items,
    {
      status: "watching",
      genre: "travel",
      frameType: "Frame B",
      urgency: "no_deadline",
      sort: "newest"
    },
    now
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "watchlist-2");
});

test("sortWatchlistItems supports newest, deadline_soon, and saved_order", () => {
  assert.deepEqual(
    sortWatchlistItems(items, "newest").map((item) => item.id),
    ["watchlist-1", "watchlist-2", "watchlist-3"]
  );
  assert.deepEqual(
    sortWatchlistItems(items, "deadline_soon").map((item) => item.id),
    ["watchlist-3", "watchlist-1", "watchlist-2"]
  );
  assert.deepEqual(
    sortWatchlistItems(items, "saved_order").map((item) => item.id),
    ["watchlist-3", "watchlist-2", "watchlist-1"]
  );
});

test("hasReachedWatchlistLimit caps free plan but not paid plan", () => {
  assert.equal(FREE_WATCHLIST_LIMIT, 5);
  assert.equal(hasReachedWatchlistLimit(4, false), false);
  assert.equal(hasReachedWatchlistLimit(5, false), true);
  assert.equal(hasReachedWatchlistLimit(999, true), false);
});
