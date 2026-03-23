import test from "node:test";
import assert from "node:assert/strict";
import {
  isGenericEpisodeDescription,
  resolveEpisodeDescription
} from "../src/lib/episodeDescriptions.ts";

test("isGenericEpisodeDescription detects placeholder descriptions", () => {
  assert.equal(isGenericEpisodeDescription("Japanese episode for 2026-03-22"), true);
  assert.equal(isGenericEpisodeDescription("English adaptation for 2026-03-22"), true);
  assert.equal(isGenericEpisodeDescription("サブスクとゲームの判断ポイントを整理する回です。"), false);
});

test("resolveEpisodeDescription prefers preview text when description is generic", () => {
  assert.equal(
    resolveEpisodeDescription({
      description: "Japanese episode for 2026-03-22",
      previewText: "サブスクとゲームの使い方を、時間と支出の観点で見直す回です。"
    }),
    "サブスクとゲームの使い方を、時間と支出の観点で見直す回です。"
  );
});

test("resolveEpisodeDescription falls back to judgment summaries", () => {
  assert.equal(
    resolveEpisodeDescription({
      description: "Japanese episode for 2026-03-22",
      judgmentCards: [
        {
          topic_order: 1,
          judgment_summary: "既存契約を維持し、追加契約は抑制する。"
        }
      ]
    }),
    "既存契約を維持し、追加契約は抑制する。"
  );
});
