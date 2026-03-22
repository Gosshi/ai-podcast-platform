import test from "node:test";
import assert from "node:assert/strict";
import type { JudgmentCard } from "../src/lib/judgmentCards.ts";
import {
  formatEpisodeTitle,
  formatTopicTitle,
  isGenericEpisodeTitle,
  resolveDisplayEpisodeTitle,
  resolveJapaneseEpisodeTitle
} from "../src/lib/episodeTitles.ts";

test("formatEpisodeTitle maps known English-style titles to concise Japanese labels", () => {
  assert.equal(formatEpisodeTitle("Daily Topic 2026-03-22 (JA)"), "Daily Topic 2026-03-22 (JA)");
  assert.equal(formatEpisodeTitle("Product workflow highlight"), "使い方の見直し");
  assert.equal(formatEpisodeTitle("Streaming cleanup"), "サブスク整理");
});

test("formatTopicTitle maps English topic labels to concise Japanese labels", () => {
  assert.equal(formatTopicTitle("Streaming cleanup"), "サブスク整理");
  assert.equal(formatTopicTitle("AI最新動向"), "AI最新動向");
});

test("isGenericEpisodeTitle detects placeholder-style episode titles", () => {
  assert.equal(isGenericEpisodeTitle("Daily Topic 2026-03-22 (JA)"), true);
  assert.equal(isGenericEpisodeTitle("デイリートピック 2026-03-22"), true);
  assert.equal(isGenericEpisodeTitle("使い方の見直し"), false);
});

test("resolveJapaneseEpisodeTitle prefers non-generic topic titles", () => {
  assert.equal(
    resolveJapaneseEpisodeTitle({
      topicTitle: "Product workflow highlight",
      episodeDate: "2026-03-22"
    }),
    "使い方の見直し"
  );
});

test("resolveJapaneseEpisodeTitle falls back to first judgment card title when topic is generic", () => {
  const cards: JudgmentCard[] = [
    {
      topic_order: 2,
      topic_title: "AI最新動向",
      frame_type: null,
      judgment_type: "use_now",
      judgment_summary: "summary",
      action_text: null,
      deadline_at: null,
      threshold_json: {},
      watch_points: [],
      confidence_score: null
    },
    {
      topic_order: 1,
      topic_title: "使い方の見直し",
      frame_type: null,
      judgment_type: "watch",
      judgment_summary: "summary",
      action_text: null,
      deadline_at: null,
      threshold_json: {},
      watch_points: [],
      confidence_score: null
    }
  ];

  assert.equal(
    resolveJapaneseEpisodeTitle({
      topicTitle: "デイリートピック 2026-03-22",
      judgmentCards: cards,
      episodeDate: "2026-03-22"
    }),
    "使い方の見直し"
  );
});

test("resolveDisplayEpisodeTitle uses first judgment card title for generic placeholders", () => {
  assert.equal(
    resolveDisplayEpisodeTitle({
      title: "Daily Topic 2026-03-22 (JA)",
      judgmentCards: [
        { topic_order: 2, topic_title: "AI最新動向" },
        { topic_order: 1, topic_title: "使い方の見直し" }
      ]
    }),
    "使い方の見直し"
  );
});
