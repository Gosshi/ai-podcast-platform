import test from "node:test";
import assert from "node:assert/strict";
import { calculateDuplicateRatio, checkScriptQuality } from "../supabase/functions/_shared/scriptQualityCheck.ts";

test("calculateDuplicateRatio returns ratio from repeated lines", () => {
  const script = [
    "これは十分に長い重複テキストです。これは十分に長い重複テキストです。",
    "これは十分に長い重複テキストです。これは十分に長い重複テキストです。",
    "別の長文ラインです。内容は異なります。"
  ].join("\n");

  const result = calculateDuplicateRatio(script);
  assert.equal(result.duplicateLineCount, 1);
  assert.equal(result.duplicateRatio > 0.3, true);
});

test("checkScriptQuality passes valid long script", () => {
  const line = "日本語の自然な放送原稿です。重複を避けて内容を整理しています。";
  const script = new Array(80).fill(0).map((_, i) => `${line}${i}`).join("\n");
  const result = checkScriptQuality(script);

  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test("checkScriptQuality flags banned tokens and short text", () => {
  const result = checkScriptQuality("http://example.com <tag> &#45; 数式");
  assert.equal(result.ok, false);
  assert.equal(result.violations.includes("contains_http"), true);
  assert.equal(result.violations.includes("contains_lt"), true);
  assert.equal(result.violations.includes("contains_html_entity"), true);
  assert.equal(result.violations.includes("contains_math_token"), true);
  assert.equal(result.violations.includes("too_short"), true);
});
