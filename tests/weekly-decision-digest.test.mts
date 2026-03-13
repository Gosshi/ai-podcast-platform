import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyDecisionDigest } from "../src/lib/weeklyDecisionDigest.ts";

const cards = [
  {
    judgment_type: "watch" as const,
    deadline_at: null,
    created_at: "2026-03-12T00:00:00.000Z",
    episode_published_at: "2026-03-12T00:00:00.000Z",
    genre: "tech",
    frame_type: "Frame B"
  },
  {
    judgment_type: "use_now" as const,
    deadline_at: "2026-03-14T00:00:00.000Z",
    created_at: "2026-03-13T00:00:00.000Z",
    episode_published_at: "2026-03-13T00:00:00.000Z",
    genre: "entertainment",
    frame_type: "Frame A"
  },
  {
    judgment_type: "use_now" as const,
    deadline_at: "2026-03-16T00:00:00.000Z",
    created_at: "2026-03-11T00:00:00.000Z",
    episode_published_at: "2026-03-11T00:00:00.000Z",
    genre: "entertainment",
    frame_type: "Frame A"
  }
];

test("buildWeeklyDecisionDigest groups cards and computes breakdowns", () => {
  const digest = buildWeeklyDecisionDigest(cards, null);

  assert.equal(digest.counts.use_now, 2);
  assert.equal(digest.counts.watch, 1);
  assert.equal(digest.genreBreakdown[0]?.key, "entertainment");
  assert.equal(digest.genreBreakdown[0]?.count, 2);
  assert.equal(digest.frameTypeBreakdown[0]?.key, "Frame A");
});

test("buildWeeklyDecisionDigest limits preview groups for free views", () => {
  const digest = buildWeeklyDecisionDigest(cards, 1);

  assert.equal(digest.groupedVisible.use_now.length, 1);
  assert.equal(digest.groupedVisible.watch.length, 1);
  assert.equal(digest.previewLimited, true);
});
