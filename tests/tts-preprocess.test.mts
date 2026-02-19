import test from "node:test";
import assert from "node:assert/strict";
import { preprocessForTTS } from "../supabase/functions/_shared/ttsPreprocess.ts";

test("preprocessForTTS ja replaces urls and maps english terms", () => {
  const input = "OpenAIの発表はこちら https://example.com (詳細)";
  const result = preprocessForTTS(input, "ja");

  assert.equal(result.text.includes("https://"), false);
  assert.equal(result.text.includes("概要欄をご覧ください"), true);
  assert.equal(result.text.includes("オープンエーアイ"), true);
  assert.equal(result.metrics.urlReplacedCount, 1);
  assert.equal(result.metrics.bracketRemovedCount > 0, true);
});

test("preprocessForTTS en normalizes punctuation and show-notes phrase", () => {
  const input = "Look here: https://example.com!!!";
  const result = preprocessForTTS(input, "en");

  assert.equal(result.text.includes("https://"), false);
  assert.equal(result.text.includes("please see the show notes"), true);
  assert.equal(result.text.includes("!!!"), false);
});
