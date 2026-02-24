import test from "node:test";
import assert from "node:assert/strict";
import {
  isEntertainmentTrendCategory,
  isHardTrendCategory,
  normalizeTrendCategory,
  resolveSourceReliabilityBonus
} from "../supabase/functions/_shared/trendUtils.ts";

test("normalizeTrendCategory maps aliases to canonical categories", () => {
  assert.equal(normalizeTrendCategory("music"), "entertainment");
  assert.equal(normalizeTrendCategory("gaming"), "game");
  assert.equal(normalizeTrendCategory("politics"), "policy");
  assert.equal(normalizeTrendCategory("startup"), "tech");
  assert.equal(normalizeTrendCategory("unknown-category"), "general");
});

test("category helpers classify entertainment and hard topics", () => {
  assert.equal(isEntertainmentTrendCategory("anime"), true);
  assert.equal(isEntertainmentTrendCategory("streaming"), true);
  assert.equal(isEntertainmentTrendCategory("policy"), false);
  assert.equal(isHardTrendCategory("news"), true);
  assert.equal(isHardTrendCategory("politics"), true);
  assert.equal(isHardTrendCategory("entertainment"), false);
});

test("resolveSourceReliabilityBonus gives bonus for curated sources", () => {
  assert.equal(resolveSourceReliabilityBonus("animenewsnetwork", null) > 0, true);
  assert.equal(resolveSourceReliabilityBonus("unknown", "Unknown Source"), 0);
});
