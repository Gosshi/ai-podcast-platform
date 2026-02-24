import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNoBadTokens,
  decodeEntities,
  normalizeWhitespace,
  removePlaceholders,
  removeUrls,
  sanitizeScriptText,
  stripHtml
} from "../supabase/functions/_shared/scriptSanitizer.ts";

test("stripHtml removes tags", () => {
  assert.equal(stripHtml("<p>Hello</p><a href='x'>x</a>"), " Hello  x ");
});

test("decodeEntities handles numeric and named entities", () => {
  assert.equal(decodeEntities("A &amp; B #8217; &#45;"), "A & B ’ -");
});

test("removeUrls removes http/https/www patterns", () => {
  assert.equal(removeUrls("https://example.com and www.test.dev"), "  and  ");
});

test("removePlaceholders removes placeholder words", () => {
  const input = "TODO 続きを読む... 確認中 <a href='x'>x</a> 数式";
  const output = removePlaceholders(input);
  assert.equal(output.includes("TODO"), false);
  assert.equal(output.includes("確認中"), false);
  assert.equal(output.includes("数式"), false);
});

test("normalizeWhitespace compacts whitespace and newlines", () => {
  assert.equal(normalizeWhitespace("a   b\n\n\n c"), "a b\n\n c");
});

test("sanitizeScriptText composes cleaning steps", () => {
  const input = "<p>本文 &amp; 詳細</p> https://example.com TODO";
  const output = sanitizeScriptText(input);
  assert.equal(output.includes("https://"), false);
  assert.equal(output.includes("TODO"), false);
  assert.equal(output.includes("&"), true);
});

test("assertNoBadTokens throws when bad token exists", () => {
  assert.throws(() => assertNoBadTokens("本文にhttps://example.comがあります"), /bad_tokens_detected/);
});
