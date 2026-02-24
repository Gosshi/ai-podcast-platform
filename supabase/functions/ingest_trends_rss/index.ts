import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  DEFAULT_CLICKBAIT_KEYWORDS,
  DEFAULT_TREND_RSS_SOURCES,
  parseCsvList
} from "../_shared/trendsConfig.ts";
import {
  applyTrendCaps,
  calculateTrendScore,
  resolveRequestedPerSourceLimit,
  resolveTrendIngestConfigFromRaw
} from "../_shared/trendIngestPolicy.ts";
import {
  isEntertainmentTrendCategory,
  normalizeTrendCategory,
  resolveSourceReliabilityBonus
} from "../_shared/trendUtils.ts";

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
  sourceKey: string;
  sourceName: string;
  sourceWeight: number;
  sourceCategory: string;
  sourceTheme: string | null;
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
  hasSensitiveHardKeyword: boolean;
  hasOverheatedKeyword: boolean;
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

const TITLE_SIMILARITY_THRESHOLD = 0.66;
const META_FETCH_TIMEOUT_MS = 3000;
const META_FETCH_MAX_TEXT_CHARS = 200_000;
const DEFAULT_RSS_FETCH_TIMEOUT_MS = 4500;
const MIN_RSS_FETCH_TIMEOUT_MS = 1200;
const MAX_RSS_FETCH_TIMEOUT_MS = 12000;
const DEFAULT_ENTERTAINMENT_BONUS = 0.35;
const DEFAULT_ENTERTAINMENT_FLOOR_SHARE = 0.42;
const DEFAULT_HARD_TOPIC_KEYWORDS = [
  "diet pill",
  "diet pills",
  "ozempic",
  "wegovy",
  "mounjaro",
  "fatal",
  "deaths",
  "killed",
  "homicide",
  "shooting",
  "murder",
  "crime",
  "arrested",
  "accident",
  "crash",
  "disaster",
  "earthquake",
  "tsunami",
  "war",
  "invasion",
  "terror",
  "投薬事故",
  "ダイエット薬",
  "事故",
  "逮捕",
  "事件",
  "犯罪",
  "災害",
  "戦争"
] as const;
const DEFAULT_OVERHEATED_KEYWORDS = [
  "exposed",
  "leaked",
  "controversy",
  "outrage",
  "meltdown",
  "炎上",
  "暴露",
  "流出",
  "激怒"
] as const;
const normalizeToken = (value: string): string => value.trim().toLowerCase();

const resolveEntertainmentBonus = (): number => {
  const raw = Number.parseFloat(
    Deno.env.get("TREND_ENTERTAINMENT_BONUS") ?? `${DEFAULT_ENTERTAINMENT_BONUS}`
  );
  if (!Number.isFinite(raw)) return DEFAULT_ENTERTAINMENT_BONUS;
  return Math.max(0, Math.min(raw, 3));
};

const ENTERTAINMENT_BONUS_VALUE = resolveEntertainmentBonus();

const resolveEntertainmentFloorShare = (): number => {
  const raw = Number.parseFloat(
    Deno.env.get("TREND_ENTERTAINMENT_FLOOR_SHARE") ?? `${DEFAULT_ENTERTAINMENT_FLOOR_SHARE}`
  );
  if (!Number.isFinite(raw)) return DEFAULT_ENTERTAINMENT_FLOOR_SHARE;
  return Math.max(0, Math.min(raw, 1));
};

const ENTERTAINMENT_FLOOR_SHARE = resolveEntertainmentFloorShare();

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const resolveRssFetchTimeoutMs = (): number => {
  const raw = Number.parseInt(
    Deno.env.get("TREND_RSS_FETCH_TIMEOUT_MS") ?? `${DEFAULT_RSS_FETCH_TIMEOUT_MS}`,
    10
  );
  if (!Number.isFinite(raw)) return DEFAULT_RSS_FETCH_TIMEOUT_MS;
  return clamp(raw, MIN_RSS_FETCH_TIMEOUT_MS, MAX_RSS_FETCH_TIMEOUT_MS);
};

const parseKeywordList = (raw: string | undefined, fallback: readonly string[]): string[] => {
  return parseCsvList(raw, Array.from(fallback))
    .map((keyword) => normalizeToken(keyword))
    .filter((keyword) => keyword.length > 0);
};

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

const containsKeyword = (text: string, keywords: string[]): boolean => {
  const normalized = normalizeToken(text);
  return keywords.some((keyword) => keyword.length > 0 && normalized.includes(keyword));
};

const containsClickbaitKeyword = (title: string, keywords: string[]): boolean => {
  return containsKeyword(title, keywords);
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
          category: normalizeTrendCategory(feed.category ?? "general"),
          theme: feed.theme ?? "mock"
        }))
      : DEFAULT_TREND_RSS_SOURCES.map((source) => ({
          ...source,
          category: normalizeTrendCategory(source.category)
        }));

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
  const ingestConfig = resolveTrendIngestConfigFromRaw({
    maxItemsTotal: Deno.env.get("TREND_MAX_ITEMS_TOTAL") ?? undefined,
    maxItemsPerSource: Deno.env.get("TREND_MAX_ITEMS_PER_SOURCE") ?? undefined,
    requirePublishedAt: Deno.env.get("TREND_REQUIRE_PUBLISHED_AT") ?? undefined,
    categoryWeights: Deno.env.get("TREND_CATEGORY_WEIGHTS") ?? undefined
  });
  const limitPerSource = resolveRequestedPerSourceLimit(
    body.limitPerSource,
    ingestConfig.maxItemsPerSource
  );

  const runId = await startTrendRun({
    step: "ingest_trends_rss",
    limitPerSource,
    maxItemsTotal: ingestConfig.maxItemsTotal,
    maxItemsPerSource: ingestConfig.maxItemsPerSource,
    requirePublishedAt: ingestConfig.requirePublishedAt,
    categoryWeights: ingestConfig.categoryWeights,
    rssFetchTimeoutMs: resolveRssFetchTimeoutMs(),
    usingMockFeeds: Boolean(body.mockFeeds?.length)
  });

  let fetchedCount = 0;
  let insertedCount = 0;
  let dedupedCount = 0;
  let publishedAtFilledCount = 0;
  let publishedAtRequiredFilteredCount = 0;
  let droppedTotalCount = 0;
  let droppedPerSourceCount = 0;
  let sourceTimeoutCount = 0;
  let hardKeywordCandidateCount = 0;
  let overheatedCandidateCount = 0;

  try {
    const sourceRows = await upsertSources(body);
    const sourceErrors: { sourceKey: string; message: string }[] = [];
    const mockFeedMap = new Map(body.mockFeeds?.map((feed) => [feed.sourceKey, feed.xml]) ?? []);
    const clickbaitKeywords = parseKeywordList(
      Deno.env.get("TREND_CLICKBAIT_KEYWORDS") ?? undefined,
      DEFAULT_CLICKBAIT_KEYWORDS
    );
    const sensitiveHardKeywords = parseKeywordList(
      Deno.env.get("TREND_HARD_KEYWORDS") ?? undefined,
      DEFAULT_HARD_TOPIC_KEYWORDS
    );
    const overheatedKeywords = parseKeywordList(
      Deno.env.get("TREND_OVERHEATED_KEYWORDS") ?? undefined,
      DEFAULT_OVERHEATED_KEYWORDS
    );
    const rssFetchTimeoutMs = resolveRssFetchTimeoutMs();

    const metaPublishedAtCache = new Map<string, string | null>();
    const candidates: CandidateItem[] = [];

    for (const source of sourceRows) {
      try {
        const mockXml = mockFeedMap.get(source.source_key);
        let xml = mockXml;
        if (!xml) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), rssFetchTimeoutMs);
          try {
            const response = await fetch(source.url, {
              method: "GET",
              redirect: "follow",
              signal: controller.signal,
              headers: {
                Accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.1",
                "User-Agent": "ai-podcast-platform-trends/1.0"
              }
            });
            if (!response.ok) {
              throw new Error(`rss_fetch_failed:${response.status}`);
            }
            xml = await response.text();
          } finally {
            clearTimeout(timer);
          }
        }

        if (!xml) {
          throw new Error("rss_fetch_empty");
        }
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
          if (ingestConfig.requirePublishedAt && published.publishedAtSource === "fetched") {
            publishedAtRequiredFilteredCount += 1;
            continue;
          }

          const normalizedTitle = normalizeTitleForHash(parsed.title) || parsed.title.trim().toLowerCase();
          const [normalizedTitleHash, urlHash, hash] = await Promise.all([
            hashText(normalizedTitle),
            hashText(normalizedUrl),
            hashText(`${source.source_key}:${normalizedUrl}`)
          ]);

          candidates.push({
            sourceId: source.id,
            sourceKey: source.source_key,
            sourceName: source.name,
            sourceWeight: source.weight,
            sourceCategory: normalizeTrendCategory(source.category),
            sourceTheme: source.theme,
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
            hasClickbaitKeyword: containsClickbaitKeyword(parsed.title, clickbaitKeywords),
            hasSensitiveHardKeyword: containsKeyword(
              `${parsed.title} ${parsed.summary ?? ""}`,
              sensitiveHardKeywords
            ),
            hasOverheatedKeyword: containsKeyword(
              `${parsed.title} ${parsed.summary ?? ""}`,
              overheatedKeywords
            )
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/abort|timed?out|timeout/i.test(message)) {
          sourceTimeoutCount += 1;
        }
        sourceErrors.push({
          sourceKey: source.source_key,
          message
        });
      }
    }

    const clusters = buildClusters(candidates);
    dedupedCount += Math.max(0, candidates.length - clusters.length);

    const categoryCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    let entertainmentClusterCount = 0;
    for (const cluster of clusters) {
      const category = normalizeTrendCategory(cluster.representative.sourceCategory);
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      sourceCounts.set(cluster.representative.sourceKey, (sourceCounts.get(cluster.representative.sourceKey) ?? 0) + 1);
      if (isEntertainmentTrendCategory(category)) {
        entertainmentClusterCount += 1;
      }
    }
    const entertainmentShare = clusters.length > 0 ? entertainmentClusterCount / clusters.length : 0;
    const recentCategoryCounts = new Map<string, number>();
    const { data: recentCategoryRows, error: recentCategoryError } = await supabaseAdmin
      .from("trend_items")
      .select("source_category")
      .order("created_at", { ascending: false })
      .limit(90);
    if (!recentCategoryError) {
      for (const row of recentCategoryRows ?? []) {
        const normalized = normalizeTrendCategory(
          ((row as { source_category?: string | null }).source_category ?? "general")
        );
        recentCategoryCounts.set(normalized, (recentCategoryCounts.get(normalized) ?? 0) + 1);
      }
    }

    const scoredRepresentatives: ScoredRepresentative[] = clusters.map((cluster) => {
      const representative = cluster.representative;
      const clusterSize = cluster.items.length;
      const normalizedCategory = normalizeTrendCategory(representative.sourceCategory);
      const categoryCount = categoryCounts.get(normalizedCategory) ?? 1;
      const sourceCount = sourceCounts.get(representative.sourceKey) ?? 1;
      const recentCategoryCount = recentCategoryCounts.get(normalizedCategory) ?? 0;
      const diversityBonus = Number((1 / (recentCategoryCount + 1) + 1 / categoryCount).toFixed(6));
      const clusterKey = `${representative.normalizedTitleHash.slice(0, 16)}-${representative.urlHash.slice(0, 16)}`;
      const entertainmentBonus = isEntertainmentTrendCategory(normalizedCategory)
        ? ENTERTAINMENT_BONUS_VALUE
        : 0;
      const entertainmentFloorBonus =
        isEntertainmentTrendCategory(normalizedCategory) && entertainmentShare < ENTERTAINMENT_FLOOR_SHARE
          ? Number(((ENTERTAINMENT_FLOOR_SHARE - entertainmentShare) * 0.9).toFixed(6))
          : 0;
      const sourceReliabilityBonus = resolveSourceReliabilityBonus(
        representative.sourceKey,
        representative.sourceName
      );
      // Keep repetition in check without eliminating an entire popular category.
      const duplicatePenaltyRaw =
        Math.log2(Math.max(1, sourceCount)) * 0.1 + Math.log2(Math.max(1, categoryCount)) * 0.14;
      const duplicatePenalty = Number(Math.min(0.95, duplicatePenaltyRaw).toFixed(6));
      const score = calculateTrendScore({
        publishedAt: representative.publishedAt,
        sourceWeight: representative.sourceWeight,
        sourceCategory: normalizedCategory,
        clusterSize,
        diversityBonus,
        entertainmentFloorBonus,
        sourceReliabilityBonus,
        duplicatePenalty,
        hasClickbaitKeyword: representative.hasClickbaitKeyword,
        hasSensitiveHardKeyword: representative.hasSensitiveHardKeyword,
        hasOverheatedKeyword: representative.hasOverheatedKeyword,
        entertainmentBonusValue: entertainmentBonus,
        categoryWeights: ingestConfig.categoryWeights
      });

      if (representative.hasSensitiveHardKeyword) {
        hardKeywordCandidateCount += 1;
      }
      if (representative.hasOverheatedKeyword) {
        overheatedCandidateCount += 1;
      }

      return {
        item: {
          ...representative,
          sourceCategory: normalizedCategory
        },
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

    const cappedRepresentatives = applyTrendCaps(scoredRepresentatives, {
      maxItemsTotal: ingestConfig.maxItemsTotal,
      maxItemsPerSource: ingestConfig.maxItemsPerSource
    });
    droppedTotalCount = cappedRepresentatives.droppedTotalCount;
    droppedPerSourceCount = cappedRepresentatives.droppedPerSourceCount;

    for (const entry of cappedRepresentatives.selected) {
      const { item } = entry;
      const { error } = await supabaseAdmin.from("trend_items").insert({
        source_id: item.sourceId,
        source_name: item.sourceName,
        source_category: item.sourceCategory,
        source_theme: item.sourceTheme,
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
      publishedAtFilledCount,
      publishedAtRequiredFilteredCount,
      sourceTimeoutCount,
      hardKeywordCandidateCount,
      overheatedCandidateCount,
      droppedTotalCount,
      droppedPerSourceCount,
      maxItemsTotal: ingestConfig.maxItemsTotal,
      maxItemsPerSource: ingestConfig.maxItemsPerSource,
      requirePublishedAt: ingestConfig.requirePublishedAt
    });

    return jsonResponse({
      ok: true,
      runId,
      sourceCount: sourceRows.length,
      sourceErrors,
      fetchedCount,
      insertedCount,
      dedupedCount,
      publishedAtFilledCount,
      publishedAtRequiredFilteredCount,
      sourceTimeoutCount,
      hardKeywordCandidateCount,
      overheatedCandidateCount,
      droppedTotalCount,
      droppedPerSourceCount,
      maxItemsTotal: ingestConfig.maxItemsTotal,
      maxItemsPerSource: ingestConfig.maxItemsPerSource,
      requirePublishedAt: ingestConfig.requirePublishedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await failTrendRun(runId, message, fetchedCount, insertedCount, {
      step: "ingest_trends_rss",
      limitPerSource,
      fetchedCount,
      insertedCount,
      dedupedCount,
      publishedAtFilledCount,
      publishedAtRequiredFilteredCount,
      sourceTimeoutCount,
      hardKeywordCandidateCount,
      overheatedCandidateCount,
      droppedTotalCount,
      droppedPerSourceCount,
      maxItemsTotal: ingestConfig.maxItemsTotal,
      maxItemsPerSource: ingestConfig.maxItemsPerSource,
      requirePublishedAt: ingestConfig.requirePublishedAt
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
