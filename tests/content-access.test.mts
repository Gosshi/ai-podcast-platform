import test from "node:test";
import assert from "node:assert/strict";
import { FREE_ACCESS_WINDOW_DAYS, isWithinFreeAccessWindow } from "../app/lib/contentAccess.ts";
import { formatThresholdHighlights, lockJudgmentDetails } from "../app/lib/judgmentAccess.ts";

test("isWithinFreeAccessWindow allows items within the free recent window", () => {
  const now = new Date("2026-03-13T00:00:00.000Z");

  assert.equal(
    isWithinFreeAccessWindow("2026-03-08T00:00:00.000Z", now),
    true
  );
  assert.equal(
    isWithinFreeAccessWindow("2026-03-04T23:59:59.000Z", now),
    false
  );
  assert.equal(FREE_ACCESS_WINDOW_DAYS, 7);
});

test("lockJudgmentDetails keeps summary data and strips paid-only fields", () => {
  const locked = lockJudgmentDetails({
    action_text: "今週中に切り替える",
    deadline_at: "2026-03-15T00:00:00.000Z",
    threshold_json: {
      price: [{ raw: "月額980円以下", value: 980, unit: "JPY" }]
    },
    watch_points: ["広告比率", "週あたり視聴時間"]
  });

  assert.equal(locked.action_text, null);
  assert.equal(locked.deadline_at, null);
  assert.deepEqual(locked.threshold_json, {});
  assert.deepEqual(locked.watch_points, []);
});

test("formatThresholdHighlights summarizes threshold entries for paid UI", () => {
  assert.deepEqual(
    formatThresholdHighlights({
      price: [{ raw: "月額980円以下", value: 980, unit: "JPY" }],
      ratio: [{ raw: "広告比率15%未満", value: 15, unit: "%" }],
      other: ["週2回以上使うなら継続"]
    }),
    ["価格基準: 月額980円以下", "比率基準: 広告比率15%未満", "週2回以上使うなら継続"]
  );
});
