import test from "node:test";
import assert from "node:assert/strict";
import { buildTrendDigest, resolveTrendDigestConfigFromRaw } from "../supabase/functions/_shared/trendDigest.ts";

test("trend digest removes HTML, URLs, and banned tokens", () => {
  const config = resolveTrendDigestConfigFromRaw({
    maxHardNews: "2",
    maxItems: "5"
  });
  const result = buildTrendDigest(
    [
      {
        id: "t1",
        title: "<a href='https://example.com'>Big &#8217; Game 数式</a>",
        summary: "Summary with http://example.com/details and <b>HTML</b> tags.",
        source: "Game Site",
        url: "https://example.com/news",
        category: "game",
        score: 10,
        publishedAt: new Date().toISOString(),
        clusterSize: 2
      }
    ],
    config
  );

  assert.equal(result.usedCount, 1);
  const item = result.items[0];
  assert.ok(item);
  assert.equal(item.cleanedTitle.includes("<a"), false);
  assert.equal(item.cleanedTitle.includes("http"), false);
  assert.equal(item.cleanedTitle.includes("&#"), false);
  assert.equal(item.cleanedTitle.includes("#8217"), false);
  assert.equal(item.cleanedTitle.includes("数式"), false);
  assert.equal(item.whatHappened.includes("http"), false);
});

test("trend digest deny keyword filter excludes unsafe topics", () => {
  const config = resolveTrendDigestConfigFromRaw({
    denyKeywords: "self-harm,illegal drug",
    maxHardNews: "1",
    maxItems: "5"
  });
  const result = buildTrendDigest(
    [
      {
        id: "safe",
        title: "Music festival update",
        summary: "Lineup and schedule updates were announced.",
        source: "Music News",
        url: "https://example.com/music",
        category: "music",
        score: 9,
        publishedAt: new Date().toISOString(),
        clusterSize: 1
      },
      {
        id: "unsafe",
        title: "Unsafe topic",
        summary: "This contains self-harm related wording.",
        source: "Unknown",
        url: "https://example.com/unsafe",
        category: "news",
        score: 8,
        publishedAt: new Date().toISOString(),
        clusterSize: 1
      }
    ],
    config
  );

  assert.equal(result.usedCount, 1);
  assert.equal(result.filteredCount >= 1, true);
  assert.deepEqual(result.items.map((item) => item.id), ["safe"]);
});

test("trend digest variety keeps entertainment and caps hard news", () => {
  const config = resolveTrendDigestConfigFromRaw({
    maxHardNews: "1",
    maxItems: "4"
  });
  const now = new Date().toISOString();
  const result = buildTrendDigest(
    [
      {
        id: "n1",
        title: "Policy update A",
        summary: "Government announced policy updates.",
        source: "News A",
        url: "https://example.com/n1",
        category: "news",
        score: 10,
        publishedAt: now,
        clusterSize: 2
      },
      {
        id: "n2",
        title: "Policy update B",
        summary: "Another policy update.",
        source: "News B",
        url: "https://example.com/n2",
        category: "politics",
        score: 9.5,
        publishedAt: now,
        clusterSize: 2
      },
      {
        id: "e1",
        title: "Anime movie release",
        summary: "A major anime movie release date was announced.",
        source: "Anime News",
        url: "https://example.com/e1",
        category: "anime",
        score: 9,
        publishedAt: now,
        clusterSize: 1
      },
      {
        id: "s1",
        title: "Tech launch",
        summary: "A new consumer gadget was launched.",
        source: "Tech News",
        url: "https://example.com/s1",
        category: "tech",
        score: 8,
        publishedAt: now,
        clusterSize: 1
      }
    ],
    config
  );

  const hardCount = result.items.filter((item) => ["news", "politics"].includes(item.category)).length;
  const entertainmentCount = result.items.filter((item) => ["anime", "entertainment", "game", "music", "movie", "video"].includes(item.category)).length;

  assert.equal(hardCount <= 1, true);
  assert.equal(entertainmentCount >= 1, true);
  assert.equal(new Set(result.items.map((item) => item.cleanedTitle)).size, result.items.length);
});
