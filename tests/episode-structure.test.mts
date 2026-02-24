import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveEpisodeStructureConfigFromRaw,
  validateEpisodeScriptQuality
} from "../supabase/functions/_shared/episodeStructure.ts";

test("episode structure config resolves defaults and env overrides", () => {
  const defaults = resolveEpisodeStructureConfigFromRaw({});
  assert.equal(defaults.deepDiveCount, 3);
  assert.equal(defaults.quickNewsCount, 6);
  assert.equal(defaults.totalTargetChars, 4600);

  const overridden = resolveEpisodeStructureConfigFromRaw({
    deepDiveCount: "3",
    quickNewsCount: "6",
    totalTargetChars: "3200"
  });
  assert.equal(overridden.deepDiveCount, 3);
  assert.equal(overridden.quickNewsCount, 6);
  assert.equal(overridden.totalTargetChars, 3200);
});

test("quality gate detects quicknews mismatch and banned tokens", () => {
  const config = resolveEpisodeStructureConfigFromRaw({
    quickNewsCount: "6",
    totalTargetChars: "4600"
  });
  const script = "本編です。http://example.com は本文で読み上げません。";

  const result = validateEpisodeScriptQuality({
    script,
    itemsUsedCount: {
      deepdive: 2,
      quicknews: 5,
      letters: 1
    },
    config
  });

  assert.equal(result.ok, false);
  assert.equal(result.violations.includes("quicknews_count_mismatch"), true);
  assert.equal(result.violations.includes("contains_banned_token"), true);
});

test("quality gate passes script within target tolerance and expected quicknews count", () => {
  const config = resolveEpisodeStructureConfigFromRaw({
    quickNewsCount: "6",
    totalTargetChars: "4600"
  });
  const script = "これは検証用の本文です。".repeat(380);

  const result = validateEpisodeScriptQuality({
    script,
    itemsUsedCount: {
      deepdive: 2,
      quicknews: 6,
      letters: 1
    },
    config
  });

  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
});

test("quality gate allows url tokens inside SOURCES section only", () => {
  const config = resolveEpisodeStructureConfigFromRaw({
    quickNewsCount: "6",
    totalTargetChars: "4600"
  });
  const script = [
    "[OP]",
    "本文はURLを読み上げません。",
    "",
    "[SOURCES]",
    "1. URL: https://example.com/source"
  ].join("\n");

  const result = validateEpisodeScriptQuality({
    script,
    itemsUsedCount: {
      deepdive: 3,
      quicknews: 6,
      letters: 0
    },
    config
  });

  assert.equal(result.violations.includes("contains_banned_token"), false);
});
