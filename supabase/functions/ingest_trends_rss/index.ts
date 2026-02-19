import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  DEFAULT_CLICKBAIT_KEYWORDS,
  DEFAULT_TREND_RSS_SOURCES,
  parseCsvList
} from "../_shared/trendsConfig.ts";

type RequestBody = {
  limitPerSource?: number;
  mockFeeds?: {
    sourceKey: string;
    name?: string;
    url?: string;
    weight?: number;
    category?: string;
    theme?: string;
    xml: string;
  }[];
};

type TrendSource = {
  id: string;
  source_key: string;
  name: string;
  url: string;
  enabled: boolean;
  weight: number;
  category: string;
  theme: string | null;
};

type ParsedItem = {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
};

type PublishedAtResolution = {
  publishedAt: string;
  publishedAtSource: "rss" | "meta" | "fetched";
  publishedAtFallback: string | null;
};

type CandidateItem = {
  sourceId: string;
  sourceWeight: number;
  sourceCategory: string;
  title: string;
  summary: string | null;
  url: string;
  normalizedUrl: string;
  normalizedTitleHash: string;
  normalizedHash: string;
  hash: string;
  urlHash: string;
  publishedAt: string;
  publishedAtSource: "rss" | "meta" | "fetched";
  publishedAtFallback: string | null;
  titleTokens: Set<string>;
  hasClickbaitKeyword: boolean;
};

type TrendCluster = {
  representative: CandidateItem;
  representativeTokens: Set<string>;
  normalizedUrls: Set<string>;
  titleHashes: Set<string>;
  items: CandidateItem[];
};

type ScoredRepresentative = {
  item: CandidateItem;
  clusterSize: number;
  clusterKey: string;
  score: number;
  scoreFreshness: number;
  scoreSource: number;
  scoreBonus: number;
  scorePenalty: number;
};

const DEFAULT_LIMIT_PER_SOURCE = 20;
const MIN_LIMIT_PER_SOURCE = 1;
const MAX_LIMIT_PER_SOURCE = 50;
const FRESHNESS_HALF_LIFE_HOURS = 20;
const MAX_FRESHNESS_WINDOW_HOURS = 72;
const TITLE_SIMILARITY_THRESHOLD = 0.66;
const META_FETCH_TIMEOUT_MS = 3000;
const META_FETCH_MAX_TEXT_CHARS = 200_000;
const DEFAULT_ENTERTAINMENT_BONUS = 0.35;
const ENTERTAINMENT_BONUS_CATEGORIES = new Set([
  "entertainment",
  "culture",
  "sports",
  "music",
  "movie",
  "anime",
  "game",
  "gaming",
  "video",
  "youtube",
  "streaming",
  "celebrity"
]);

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const resolveEntertainmentBonus = (): number => {
  const raw = Number.parseFloat(
    Deno.env.get("TREND_ENTERTAINMENT_BONUS") ?? `${DEFAULT_ENTERTAINMENT_BONUS}`
  );
  if (!Number.isFinite(raw)) return DEFAULT_ENTERTAINMENT_BONUS;
  return Math.max(0, Math.min(raw, 3));
};

const ENTERTAINMENT_BONUS_VALUE = resolveEntertainmentBonus();

const normalizeTitleForHash = (value: string): string => {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
};

const normalizeTitleForSimilarity = (value: string): string => {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const tokenizeTitle = (value: string): Set<string> => {
  const normalized = normalizeTitleForSimilarity(value);
  if (!normalized) {
    return new Set();
  }

  return new Set(
    normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
  );
};

const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const normalizeDate = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    const trackedParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"
    ];

    for (const param of trackedParams) {
      url.searchParams.delete(param);
    }

    const sortedParams = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [key, paramValue] of sortedParams) {
      url.searchParams.append(key, paramValue);
    }

    url.hash = "";
    url.hostname = url.hostname.toLowerCase();

    return url.toString();
  } catch {
    return null;
  }
};

const containsClickbaitKeyword = (title: string, keywords: string[]): boolean => {
  const normalized = title.toLowerCase();
  return keywords.some((keyword) => keyword.length > 0 && normalized.includes(keyword.toLowerCase()));
};

const resolveFreshnessScore = (publishedAt: string): number => {
  const baseline = new Date(publishedAt);
  if (Number.isNaN(baseline.getTime())) return 0;

  const diffMs = Math.max(0, Date.now() - baseline.getTime());
  const ageHours = Math.min(diffMs / (60 * 60 * 1000), MAX_FRESHNESS_WINDOW_HOURS);
  const decay = Math.exp((-Math.log(2) * ageHours) / FRESHNESS_HALF_LIFE_HOURS);
  return decay * 2;
};

const calculateScore = (params: {
  publishedAt: string;
  sourceWeight: number;
  sourceCategory: string;
  clusterSize: number;
  diversityBonus: number;
  hasClickbaitKeyword: boolean;
}): {
  score: number;
  scoreFreshness: number;
  scoreSource: number;
  scoreBonus: number;
  scorePenalty: number;
} => {
  const freshness = resolveFreshnessScore(params.publishedAt);
  const sourceWeightScore = Number.isFinite(params.sourceWeight) ? Math.max(params.sourceWeight, 0) : 0;
  const clusterSizeBonus = Math.log2(Math.max(params.clusterSize, 1));
  const entertainmentBonus = ENTERTAINMENT_BONUS_CATEGORIES.has(
    normalizeToken(params.sourceCategory)
  )
    ? ENTERTAINMENT_BONUS_VALUE
    : 0;
  const bonusScore = clusterSizeBonus + params.diversityBonus + entertainmentBonus;
  const clickbaitPenalty = params.hasClickbaitKeyword ? 1.1 : 0;

  const raw = freshness + sourceWeightScore + bonusScore - clickbaitPenalty;
  return {
    score: Number(raw.toFixed(6)),
    scoreFreshness: Number(freshness.toFixed(6)),
    scoreSource: Number(sourceWeightScore.toFixed(6)),
    scoreBonus: Number(bonusScore.toFixed(6)),
    scorePenalty: Number(clickbaitPenalty.toFixed(6))
  };
};

const decodeXmlText = (value: string): string => {
  return value
    .replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
};

const readTag = (xmlBlock: string, tagNames: string[]): string | null => {
  for (const tagName of tagNames) {
    const match = xmlBlock.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
    if (match?.[1]) {
      return decodeXmlText(match[1].trim());
    }
  }

  return null;
};

const readLink = (xmlBlock: string): string | null => {
  const linkHrefMatch = xmlBlock.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (linkHrefMatch?.[1]) {
    return decodeXmlText(linkHrefMatch[1].trim());
  }

  const linkBodyMatch = xmlBlock.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  if (linkBodyMatch?.[1]) {
    return decodeXmlText(linkBodyMatch[1].trim());
  }

  return null;
};

const parseRssItems = (xml: string): ParsedItem[] => {
  const blocks = Array.from(xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)).map(
    (match) => match[0]
  );

  return blocks
    .map((block) => {
      const title = readTag(block, ["title"]) ?? "";
      const url = readLink(block) ?? "";
      const summary = readTag(block, ["description", "summary", "content", "content:encoded"]);
      const published = readTag(block, [
        "pubDate",
        "published",
        "updated",
        "dc:date",
        "dc:created"
      ]);

      return {
        title,
        url,
        summary,
        publishedAt: normalizeDate(published)
      };
    })
    .filter((item) => item.title.length > 0 && item.url.length > 0);
};

const hashText = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const startTrendRun = async (payload: Record<string, unknown>): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from("trend_runs")
    .insert({
      status: "running",
      payload,
      fetched_count: 0,
      inserted_count: 0
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw error ?? new Error("failed to insert trend_runs row");
  }

  return String(data.id);
};

const finishTrendRun = async (
  runId: string,
  fetchedCount: number,
  insertedCount: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("trend_runs")
    .update({
      status: "success",
      fetched_count: fetchedCount,
      inserted_count: insertedCount,
      ended_at: new Date().toISOString(),
      payload
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
};

const failTrendRun = async (
  runId: string,
  errorMessage: string,
  fetchedCount: number,
  insertedCount: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("trend_runs")
    .update({
      status: "failed",
      fetched_count: fetchedCount,
      inserted_count: insertedCount,
      error: errorMessage,
      ended_at: new Date().toISOString(),
      payload
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
};

const upsertSources = async (body: RequestBody): Promise<TrendSource[]> => {
  const sourceSeeds =
    body.mockFeeds && body.mockFeeds.length > 0
      ? body.mockFeeds.map((feed) => ({
          source_key: feed.sourceKey,
          name: feed.name ?? feed.sourceKey,
          url: feed.url ?? `mock://${feed.sourceKey}`,
          enabled: true,
          weight: feed.weight ?? 1,
          category: feed.category ?? "general",
          theme: feed.theme ?? "mock"
        }))
      : DEFAULT_TREND_RSS_SOURCES;

  const { error: upsertError } = await supabaseAdmin.from("trend_sources").upsert(sourceSeeds, {
    onConflict: "source_key"
  });
  if (upsertError) {
    throw upsertError;
  }

  const sourceKeys = sourceSeeds.map((source) => source.source_key);
  let query = supabaseAdmin
    .from("trend_sources")
    .select("id, source_key, name, url, enabled, weight, category, theme")
    .in("source_key", sourceKeys)
    .order("source_key", { ascending: true });

  if (!body.mockFeeds || body.mockFeeds.length === 0) {
    query = query.eq("enabled", true);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data as TrendSource[]) ?? [];
};

const readMetaTagContent = (html: string, attrName: string, attrValue: string): string | null => {
  const safeAttr = attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]*${attrName}=["']${safeAttr}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reverseRegex = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${safeAttr}["'][^>]*>`,
    "i"
  );

  const match = html.match(regex) ?? html.match(reverseRegex);
  return match?.[1]?.trim() ?? null;
};

const extractPublishedAtFromMeta = (html: string): string | null => {
  const keys: Array<["property" | "name" | "itemprop", string]> = [
    ["property", "article:published_time"],
    ["property", "og:published_time"],
    ["property", "article:modified_time"],
    ["name", "pubdate"],
    ["name", "publishdate"],
    ["name", "date"],
    ["name", "dc.date"],
    ["itemprop", "datePublished"],
    ["itemprop", "dateCreated"]
  ];

  for (const [attrName, attrValue] of keys) {
    const raw = readMetaTagContent(html, attrName, attrValue);
    const normalized = normalizeDate(raw);
    if (normalized) {
      return normalized;
    }
  }

  const jsonLdMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  const jsonLdDate = normalizeDate(jsonLdMatch?.[1] ?? null);
  if (jsonLdDate) {
    return jsonLdDate;
  }

  return null;
};

const fetchPublishedAtFromMeta = async (
  normalizedUrl: string,
  cache: Map<string, string | null>
): Promise<string | null> => {
  if (cache.has(normalizedUrl)) {
    return cache.get(normalizedUrl) ?? null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(normalizedUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ai-podcast-platform-trends/1.0"
      }
    });

    if (!response.ok) {
      cache.set(normalizedUrl, null);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) {
      cache.set(normalizedUrl, null);
      return null;
    }

    const html = (await response.text()).slice(0, META_FETCH_MAX_TEXT_CHARS);
    const publishedAt = extractPublishedAtFromMeta(html);
    cache.set(normalizedUrl, publishedAt);
    return publishedAt;
  } catch {
    cache.set(normalizedUrl, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const resolvePublishedAt = async (
  parsedPublishedAt: string | null,
  normalizedUrl: string,
  fetchedAt: string,
  metaCache: Map<string, string | null>
): Promise<PublishedAtResolution> => {
  if (parsedPublishedAt) {
    return {
      publishedAt: parsedPublishedAt,
      publishedAtSource: "rss",
      publishedAtFallback: null
    };
  }

  const metaPublishedAt = await fetchPublishedAtFromMeta(normalizedUrl, metaCache);
  if (metaPublishedAt) {
    return {
      publishedAt: metaPublishedAt,
      publishedAtSource: "meta",
      publishedAtFallback: null
    };
  }

  return {
    publishedAt: fetchedAt,
    publishedAtSource: "fetched",
    publishedAtFallback: fetchedAt
  };
};

const chooseRepresentative = (left: CandidateItem, right: CandidateItem): CandidateItem => {
  if (right.sourceWeight !== left.sourceWeight) {
    return right.sourceWeight > left.sourceWeight ? right : left;
  }

  if (right.publishedAt !== left.publishedAt) {
    return right.publishedAt > left.publishedAt ? right : left;
  }

  return right.title.length > left.title.length ? right : left;
};

const buildClusters = (items: CandidateItem[]): TrendCluster[] => {
  const sorted = [...items].sort((a, b) => {
    if (b.sourceWeight !== a.sourceWeight) {
      return b.sourceWeight - a.sourceWeight;
    }
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  const clusters: TrendCluster[] = [];

  for (const item of sorted) {
    const matched = clusters.find((cluster) => {
      if (cluster.normalizedUrls.has(item.normalizedUrl)) return true;
      if (cluster.titleHashes.has(item.normalizedTitleHash)) return true;

      const similarity = jaccardSimilarity(item.titleTokens, cluster.representativeTokens);
      return similarity >= TITLE_SIMILARITY_THRESHOLD;
    });

    if (!matched) {
      clusters.push({
        representative: item,
        representativeTokens: item.titleTokens,
        normalizedUrls: new Set([item.normalizedUrl]),
        titleHashes: new Set([item.normalizedTitleHash]),
        items: [item]
      });
      continue;
    }

    matched.items.push(item);
    matched.normalizedUrls.add(item.normalizedUrl);
    matched.titleHashes.add(item.normalizedTitleHash);

    const nextRepresentative = chooseRepresentative(matched.representative, item);
    matched.representative = nextRepresentative;
    matched.representativeTokens = nextRepresentative.titleTokens;
  }

  return clusters;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const limitPerSource = Math.max(
    MIN_LIMIT_PER_SOURCE,
    Math.min(body.limitPerSource ?? DEFAULT_LIMIT_PER_SOURCE, MAX_LIMIT_PER_SOURCE)
  );

  const runId = await startTrendRun({
    step: "ingest_trends_rss",
    limitPerSource,
    usingMockFeeds: Boolean(body.mockFeeds?.length)
  });

  let fetchedCount = 0;
  let insertedCount = 0;
  let dedupedCount = 0;
  let publishedAtFilledCount = 0;

  try {
    const sourceRows = await upsertSources(body);
    const sourceErrors: { sourceKey: string; message: string }[] = [];
    const mockFeedMap = new Map(body.mockFeeds?.map((feed) => [feed.sourceKey, feed.xml]) ?? []);
    const clickbaitKeywords = parseCsvList(
      Deno.env.get("TREND_CLICKBAIT_KEYWORDS") ?? undefined,
      DEFAULT_CLICKBAIT_KEYWORDS
    );

    const metaPublishedAtCache = new Map<string, string | null>();
    const candidates: CandidateItem[] = [];

    for (const source of sourceRows) {
      try {
        const xml = mockFeedMap.get(source.source_key) ?? (await fetch(source.url).then((res) => res.text()));
        const parsedItems = parseRssItems(xml).slice(0, limitPerSource);
        fetchedCount += parsedItems.length;

        for (const parsed of parsedItems) {
          const normalizedUrl = normalizeUrl(parsed.url);
          if (!normalizedUrl) {
            dedupedCount += 1;
            continue;
          }

          const fetchedAt = new Date().toISOString();
          const published = await resolvePublishedAt(
            parsed.publishedAt,
            normalizedUrl,
            fetchedAt,
            metaPublishedAtCache
          );

          if (published.publishedAtSource !== "rss") {
            publishedAtFilledCount += 1;
          }

          const normalizedTitle = normalizeTitleForHash(parsed.title) || parsed.title.trim().toLowerCase();
          const [normalizedTitleHash, urlHash, hash] = await Promise.all([
            hashText(normalizedTitle),
            hashText(normalizedUrl),
            hashText(`${source.source_key}:${normalizedUrl}`)
          ]);

          candidates.push({
            sourceId: source.id,
            sourceWeight: source.weight,
            sourceCategory: source.category,
            title: parsed.title,
            summary: parsed.summary,
            url: parsed.url,
            normalizedUrl,
            normalizedTitleHash,
            normalizedHash: normalizedTitleHash,
            hash,
            urlHash,
            publishedAt: published.publishedAt,
            publishedAtSource: published.publishedAtSource,
            publishedAtFallback: published.publishedAtFallback,
            titleTokens: tokenizeTitle(parsed.title),
            hasClickbaitKeyword: containsClickbaitKeyword(parsed.title, clickbaitKeywords)
          });
        }
      } catch (error) {
        sourceErrors.push({
          sourceKey: source.source_key,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const clusters = buildClusters(candidates);
    dedupedCount += Math.max(0, candidates.length - clusters.length);

    const categoryCounts = new Map<string, number>();
    for (const cluster of clusters) {
      const category = cluster.representative.sourceCategory || "general";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }

    const scoredRepresentatives: ScoredRepresentative[] = clusters.map((cluster) => {
      const representative = cluster.representative;
      const clusterSize = cluster.items.length;
      const categoryCount = categoryCounts.get(representative.sourceCategory || "general") ?? 1;
      const diversityBonus = Number((1 / categoryCount).toFixed(6));
      const clusterKey = `${representative.normalizedTitleHash.slice(0, 16)}-${representative.urlHash.slice(0, 16)}`;
      const score = calculateScore({
        publishedAt: representative.publishedAt,
        sourceWeight: representative.sourceWeight,
        sourceCategory: representative.sourceCategory,
        clusterSize,
        diversityBonus,
        hasClickbaitKeyword: representative.hasClickbaitKeyword
      });

      return {
        item: representative,
        clusterSize,
        clusterKey,
        score: score.score,
        scoreFreshness: score.scoreFreshness,
        scoreSource: score.scoreSource,
        scoreBonus: score.scoreBonus,
        scorePenalty: score.scorePenalty
      };
    });

    scoredRepresentatives.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.item.publishedAt.localeCompare(a.item.publishedAt);
    });

    for (const entry of scoredRepresentatives) {
      const { item } = entry;
      const { error } = await supabaseAdmin.from("trend_items").insert({
        source_id: item.sourceId,
        title: item.title,
        url: item.url,
        summary: item.summary,
        published_at: item.publishedAt,
        published_at_source: item.publishedAtSource,
        published_at_fallback: item.publishedAtFallback,
        hash: item.hash,
        normalized_hash: item.normalizedHash,
        normalized_url: item.normalizedUrl,
        normalized_title_hash: item.normalizedTitleHash,
        cluster_key: entry.clusterKey,
        cluster_size: entry.clusterSize,
        is_cluster_representative: true,
        score: entry.score,
        score_freshness: entry.scoreFreshness,
        score_source: entry.scoreSource,
        score_bonus: entry.scoreBonus,
        score_penalty: entry.scorePenalty
      });

      if (error) {
        if (error.code === "23505") {
          dedupedCount += 1;
          continue;
        }

        throw error;
      }

      insertedCount += 1;
    }

    await finishTrendRun(runId, fetchedCount, insertedCount, {
      step: "ingest_trends_rss",
      limitPerSource,
      sourceCount: sourceRows.length,
      sourceErrors,
      fetchedCount,
      insertedCount,
      dedupedCount,
      publishedAtFilledCount
    });

    return jsonResponse({
      ok: true,
      runId,
      sourceCount: sourceRows.length,
      sourceErrors,
      fetchedCount,
      insertedCount,
      dedupedCount,
      publishedAtFilledCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await failTrendRun(runId, message, fetchedCount, insertedCount, {
      step: "ingest_trends_rss",
      limitPerSource,
      fetchedCount,
      insertedCount,
      dedupedCount,
      publishedAtFilledCount
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
