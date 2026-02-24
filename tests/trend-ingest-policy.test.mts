import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTrendCaps,
  calculateTrendScore,
  resolveRequestedPerSourceLimit,
  resolveTrendIngestConfigFromRaw
} from "../supabase/functions/_shared/trendIngestPolicy.ts";

test("resolveTrendIngestConfigFromRaw uses safe defaults and parses overrides", () => {
  const defaults = resolveTrendIngestConfigFromRaw({});
  assert.equal(defaults.maxItemsTotal, 60);
  assert.equal(defaults.maxItemsPerSource, 10);
  assert.equal(defaults.requirePublishedAt, true);
  assert.equal(defaults.categoryWeights.entertainment > defaults.categoryWeights.news, true);

  const overridden = resolveTrendIngestConfigFromRaw({
    maxItemsTotal: "72",
    maxItemsPerSource: "12",
    requirePublishedAt: "false",
    categoryWeights: JSON.stringify({ entertainment: 1.5, politics: 0.7 })
  });
  assert.equal(overridden.maxItemsTotal, 72);
  assert.equal(overridden.maxItemsPerSource, 12);
  assert.equal(overridden.requirePublishedAt, false);
  assert.equal(overridden.categoryWeights.entertainment, 1.5);
  assert.equal(overridden.categoryWeights.politics, 0.7);
});

test("category weighting favors entertainment and applies hard-news penalty", () => {
  const categoryWeights = {
    general: 1,
    entertainment: 1.45,
    politics: 0.82
  };
  const publishedAt = new Date().toISOString();

  const entertainment = calculateTrendScore({
    publishedAt,
    sourceWeight: 1.2,
    sourceCategory: "entertainment",
    clusterSize: 2,
    diversityBonus: 0.5,
    entertainmentFloorBonus: 0.2,
    sourceReliabilityBonus: 0.1,
    duplicatePenalty: 0,
    hasClickbaitKeyword: false,
    hasSensitiveHardKeyword: false,
    hasOverheatedKeyword: false,
    entertainmentBonusValue: 0.35,
    categoryWeights
  });
  const politics = calculateTrendScore({
    publishedAt,
    sourceWeight: 1.2,
    sourceCategory: "politics",
    clusterSize: 2,
    diversityBonus: 0.5,
    entertainmentFloorBonus: 0,
    sourceReliabilityBonus: 0,
    duplicatePenalty: 0.2,
    hasClickbaitKeyword: false,
    hasSensitiveHardKeyword: false,
    hasOverheatedKeyword: false,
    entertainmentBonusValue: 0,
    categoryWeights
  });

  assert.equal(entertainment.score > politics.score, true);
  assert.equal(entertainment.scorePenalty < politics.scorePenalty, true);
  assert.equal(politics.hardNewsPenalty > 0, true);
});

test("caps honor total and per-source limits deterministically", () => {
  const ranked = [
    { id: "a1", item: { sourceId: "source-a" } },
    { id: "a2", item: { sourceId: "source-a" } },
    { id: "a3", item: { sourceId: "source-a" } },
    { id: "b1", item: { sourceId: "source-b" } },
    { id: "b2", item: { sourceId: "source-b" } },
    { id: "c1", item: { sourceId: "source-c" } }
  ];

  const capped = applyTrendCaps(ranked, { maxItemsTotal: 4, maxItemsPerSource: 2 });
  assert.deepEqual(capped.selected.map((item) => item.id), ["a1", "a2", "b1", "b2"]);
  assert.equal(capped.droppedPerSourceCount, 1);
  assert.equal(capped.droppedTotalCount, 1);

  assert.equal(resolveRequestedPerSourceLimit(undefined, 10), 10);
  assert.equal(resolveRequestedPerSourceLimit(3, 10), 3);
  assert.equal(resolveRequestedPerSourceLimit(50, 10), 10);
});
