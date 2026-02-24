import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeHtmlEntities,
  dedupeSimilarLines,
  normalizeScriptText,
  removePlaceholders,
  removeUrls,
  stripHtmlTags
} from "../supabase/functions/_shared/scriptNormalize.ts";

test("stripHtmlTags removes html tags", () => {
  assert.equal(stripHtmlTags("a <b>bold</b> c"), "a  bold  c");
});

test("decodeHtmlEntities decodes named and numeric entities", () => {
  assert.equal(decodeHtmlEntities("A &amp; B &#45; C &#x30C6;"), "A & B - C テ");
});

test("removeUrls removes http and www urls", () => {
  const input = "check https://example.com and www.example.org";
  assert.equal(removeUrls(input), "check   and  ");
});

test("removePlaceholders removes template-like tokens", () => {
  const input = "{{title}} [URL] SOURCE_LINK TODO";
  assert.equal(removePlaceholders(input).trim(), "");
});

test("dedupeSimilarLines drops repeated filler lines", () => {
  const input = [
    "同じ説明を繰り返します。情報は更新中で、ここは長めの補足文です。",
    "同じ説明を繰り返します。 情報は更新中で、ここは長めの補足文です。",
    "別の文です。"
  ].join("\n");

  const result = dedupeSimilarLines(input);
  assert.equal(result.dedupedLinesCount, 1);
  assert.equal(result.text.split("\n").length, 2);
});

test("normalizeScriptText removes html/url/placeholders and reports metrics", () => {
  const input = [
    "<p>本文です &amp; 続き</p>",
    "https://example.com",
    "{{placeholder}}",
    "同じ内容の長めの補足文です。重複として検出されるべきです。",
    "同じ内容の長めの補足文です。重複として検出されるべきです。"
  ].join("\n");

  const result = normalizeScriptText(input);
  assert.equal(result.text.includes("https://"), false);
  assert.equal(result.text.includes("{{"), false);
  assert.equal(result.metrics.removedHtmlCount > 0, true);
  assert.equal(result.metrics.removedUrlCount > 0, true);
  assert.equal(result.metrics.dedupedLinesCount, 1);
});

test("normalizeScriptText can preserve urls in SOURCES section", () => {
  const input = [
    "[OP]",
    "本文です https://example.com は除去されるべきです。",
    "",
    "[SOURCES]",
    "1. URL: https://example.com/source"
  ].join("\n");

  const result = normalizeScriptText(input, { preserveSourceUrls: true });
  assert.equal(result.text.includes("https://example.com/source"), true);
  assert.equal(result.text.includes("本文です https://example.com"), false);
});
