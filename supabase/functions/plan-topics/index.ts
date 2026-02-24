import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseCsvList } from "../_shared/trendsConfig.ts";
import {
  buildTrendDigest,
  resolveTrendDigestConfigFromRaw,
  type TrendDigestItem,
  type TrendDigestSourceItem
} from "../_shared/trendDigest.ts";
import {
  PROGRAM_MAIN_TOPICS_COUNT,
  PROGRAM_QUICK_NEWS_COUNT,
  PROGRAM_SMALL_TALK_COUNT,
  type ProgramPlan
} from "../_shared/programPlan.ts";
import {
  REQUIRED_ENTERTAINMENT_CATEGORIES,
  isEntertainmentTrendCategory,
  isHardTrendCategory,
  normalizeTrendCategory
} from "../_shared/trendUtils.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  trendCandidates?: {
    id?: string;
    title?: string;
    url?: string;
    summary?: string;
    source?: string;
    category?: string;
    score?: number;
    publishedAt?: string | null;
    clusterSize?: number;
    normalizedHash?: string;
  }[];
};

type TrendCandidateRow = {
  id: string | null;
  title: string | null;
  url: string | null;
  summary: string | null;
  score: number | null;
  published_at: string | null;
  cluster_size: number | null;
  is_cluster_representative: boolean | null;
  created_at: string | null;
  normalized_hash: string | null;
  trend_sources:
    | {
        category: string | null;
        name: string | null;
      }
    | {
        category: string | null;
        name: string | null;
      }[]
    | null;
};

type PlannedTrendItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  category: string;
  score: number;
  publishedAt: string | null;
  clusterSize: number;
  normalizedHash: string;
  domain: string;
  isHardTopic: boolean;
  isEntertainmentTopic: boolean;
};

type Topic = {
  title: string;
  bullets: string[];
};

type TrendSelectionConfig = {
  targetTotal: number;
  targetDeepDive: number;
  targetQuickNews: number;
  maxHardTopics: number;
  minEntertainment: number;
  sourceDiversityWindow: number;
  lookbackHours: number;
  candidatePoolSize: number;
  categoryCaps: Record<string, number>;
};

type TrendSelectionAudit = {
  targetTotal: number;
  targetDeepDive: number;
  targetQuickNews: number;
  maxHardTopics: number;
  minEntertainment: number;
  sourceDiversityWindow: number;
  selectedTotal: number;
  selectedHard: number;
  selectedEntertainment: number;
  usedFallbackItems: number;
  categoryDistribution: Record<string, number>;
  domainDistribution: Record<string, number>;
  categoryCaps: Record<string, number>;
};

const MIN_LOOKBACK_HOURS = 24;
const MAX_LOOKBACK_HOURS = 72;
const DEFAULT_LOOKBACK_HOURS = 36;

const DEFAULT_TARGET_TOTAL = 10;
const DEFAULT_TARGET_DEEPDIVE = 3;
const DEFAULT_TARGET_QUICKNEWS = 6;
const DEFAULT_MAX_HARD_TOPICS = 1;
const DEFAULT_MIN_ENTERTAINMENT = 4;
const DEFAULT_SOURCE_DIVERSITY_WINDOW = 3;
const DEFAULT_CATEGORY_CAPS: Record<string, number> = {
  game: 2,
  movie: 3,
  entertainment: 3,
  anime: 3,
  culture: 3,
  tech: 3,
  business: 2,
  policy: 1,
  general: 2
};

const MIN_TARGET_TOTAL = 8;
const MAX_TARGET_TOTAL = 14;
const MIN_CANDIDATE_POOL = 20;
const MAX_CANDIDATE_POOL = 240;

const PROGRAM_REQUIRED_TRENDS =
  PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT + PROGRAM_SMALL_TALK_COUNT;

const DEFAULT_EXCLUDED_SOURCE_CATEGORIES = [
  "investment",
  "stocks",
  "fx",
  "crypto",
  "cryptocurrency",
  "finance"
];

const DEFAULT_EXCLUDED_KEYWORDS = [
  "投資",
  "株",
  "株式",
  "fx",
  "為替",
  "暗号資産",
  "仮想通貨",
  "crypto",
  "bitcoin",
  "btc",
  "eth",
  "diet pill",
  "diet pills",
  "ozempic",
  "wegovy",
  "mounjaro",
  "違法薬物",
  "覚醒剤",
  "麻薬"
];

const fallbackTrendItems: PlannedTrendItem[] = [
  {
    id: "fallback-ent-1",
    title: "Fallback: Streaming release watch",
    url: "https://example.com/fallback/streaming",
    summary: "Streaming and creator releases are highlighted to keep the episode approachable.",
    source: "fallback-editorial",
    category: "entertainment",
    score: 1,
    publishedAt: null,
    clusterSize: 1,
    normalizedHash: "fallback-ent-1",
    domain: "example.com",
    isHardTopic: false,
    isEntertainmentTopic: true
  },
  {
    id: "fallback-game-1",
    title: "Fallback: Gaming and platform updates",
    url: "https://example.com/fallback/gaming",
    summary: "Game platform updates are included when live trends are sparse.",
    source: "fallback-editorial",
    category: "game",
    score: 1,
    publishedAt: null,
    clusterSize: 1,
    normalizedHash: "fallback-game-1",
    domain: "example.com",
    isHardTopic: false,
    isEntertainmentTopic: true
  },
  {
    id: "fallback-movie-1",
    title: "Fallback: Streaming and movie release radar",
    url: "https://example.com/fallback/movie",
    summary: "Major release windows and platform strategy changes are tracked.",
    source: "fallback-editorial",
    category: "movie",
    score: 1,
    publishedAt: null,
    clusterSize: 1,
    normalizedHash: "fallback-movie-1",
    domain: "example.com",
    isHardTopic: false,
    isEntertainmentTopic: true
  },
  {
    id: "fallback-soft-1",
    title: "Fallback: Product and creator workflow",
    url: "https://example.com/fallback/productivity",
    summary: "Product workflow changes are included as neutral context topics.",
    source: "fallback-editorial",
    category: "tech",
    score: 1,
    publishedAt: null,
    clusterSize: 1,
    normalizedHash: "fallback-soft-1",
    domain: "example.com",
    isHardTopic: false,
    isEntertainmentTopic: false
  }
];

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const compactText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const summarizeText = (value: string, maxChars: number): string => {
  const normalized = compactText(value);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}…`;
};

const resolveCategory = (row: TrendCandidateRow): string => {
  if (Array.isArray(row.trend_sources)) {
    return row.trend_sources[0]?.category ?? "general";
  }
  return row.trend_sources?.category ?? "general";
};

const resolveSourceName = (row: TrendCandidateRow): string => {
  if (Array.isArray(row.trend_sources)) {
    return row.trend_sources[0]?.name ?? "unknown";
  }
  return row.trend_sources?.name ?? "unknown";
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const parseIntWithBounds = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number => {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const normalizeHash = (title: string, url: string, fallbackId: string): string => {
  const seed = `${compactText(title)}::${compactText(url)}`.normalize("NFKC").toLowerCase();
  const normalized = seed.replace(/[^\p{Letter}\p{Number}]+/gu, "");
  return normalized || fallbackId;
};

const resolveDomain = (url: string, source: string): string => {
  try {
    const parsed = new URL(url);
    return normalizeToken(parsed.hostname);
  } catch {
    return normalizeToken(source) || "unknown";
  }
};

const isHardTopicCategory = (category: string): boolean => {
  return isHardTrendCategory(category);
};

const isEntertainmentCategory = (category: string): boolean => {
  return isEntertainmentTrendCategory(category);
};

const hydratePlannedTrendItem = (
  raw: Omit<PlannedTrendItem, "domain" | "isHardTopic" | "isEntertainmentTopic">
): PlannedTrendItem => {
  const normalizedCategory = normalizeTrendCategory(raw.category || "general");
  const domain = resolveDomain(raw.url, raw.source);
  const normalizedHash = raw.normalizedHash || normalizeHash(raw.title, raw.url, raw.id);
  return {
    ...raw,
    category: normalizedCategory,
    normalizedHash,
    domain,
    isHardTopic: isHardTopicCategory(normalizedCategory),
    isEntertainmentTopic: isEntertainmentCategory(normalizedCategory)
  };
};

const resolveCategoryCaps = (): Record<string, number> => {
  const raw = Deno.env.get("TREND_CATEGORY_CAPS");
  if (!raw) return { ...DEFAULT_CATEGORY_CAPS };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_CATEGORY_CAPS };
    }

    const caps: Record<string, number> = { ...DEFAULT_CATEGORY_CAPS };
    for (const [category, rawCap] of Object.entries(parsed)) {
      if (typeof rawCap !== "number" || !Number.isFinite(rawCap)) continue;
      const normalizedCategory = normalizeTrendCategory(category);
      if (normalizedCategory === "general" && normalizeToken(category) !== "general") continue;
      caps[normalizedCategory] = clamp(Math.floor(rawCap), 0, 10);
    }
    return caps;
  } catch {
    return { ...DEFAULT_CATEGORY_CAPS };
  }
};

const resolveSelectionConfig = (): TrendSelectionConfig => {
  const targetTotal = parseIntWithBounds(
    Deno.env.get("TREND_TARGET_TOTAL"),
    DEFAULT_TARGET_TOTAL,
    MIN_TARGET_TOTAL,
    MAX_TARGET_TOTAL
  );
  const targetDeepDive = parseIntWithBounds(
    Deno.env.get("TREND_TARGET_DEEPDIVE"),
    DEFAULT_TARGET_DEEPDIVE,
    2,
    6
  );
  const targetQuickNews = parseIntWithBounds(
    Deno.env.get("TREND_TARGET_QUICKNEWS"),
    DEFAULT_TARGET_QUICKNEWS,
    5,
    10
  );
  const minRequiredTotal = targetDeepDive + targetQuickNews;
  const normalizedTargetTotal = clamp(Math.max(targetTotal, minRequiredTotal), MIN_TARGET_TOTAL, MAX_TARGET_TOTAL);

  const maxHardTopics = parseIntWithBounds(
    Deno.env.get("TREND_MAX_HARD_TOPICS") ?? Deno.env.get("TREND_MAX_HARD_NEWS"),
    DEFAULT_MAX_HARD_TOPICS,
    0,
    4
  );
  const minEntertainment = parseIntWithBounds(
    Deno.env.get("TREND_MIN_ENTERTAINMENT"),
    DEFAULT_MIN_ENTERTAINMENT,
    0,
    normalizedTargetTotal
  );
  const sourceDiversityWindow = parseIntWithBounds(
    Deno.env.get("TREND_SOURCE_DIVERSITY_WINDOW"),
    DEFAULT_SOURCE_DIVERSITY_WINDOW,
    1,
    8
  );
  const lookbackHours = parseIntWithBounds(
    Deno.env.get("PLAN_TREND_LOOKBACK_HOURS") ?? Deno.env.get("TREND_LOOKBACK_HOURS"),
    DEFAULT_LOOKBACK_HOURS,
    MIN_LOOKBACK_HOURS,
    MAX_LOOKBACK_HOURS
  );
  const candidatePoolDefault = clamp(normalizedTargetTotal * 3, MIN_CANDIDATE_POOL, MAX_CANDIDATE_POOL);
  const candidatePoolSize = parseIntWithBounds(
    Deno.env.get("PLAN_TREND_TOP_N"),
    candidatePoolDefault,
    normalizedTargetTotal,
    MAX_CANDIDATE_POOL
  );

  return {
    targetTotal: normalizedTargetTotal,
    targetDeepDive,
    targetQuickNews,
    maxHardTopics,
    minEntertainment,
    sourceDiversityWindow,
    lookbackHours,
    candidatePoolSize,
    categoryCaps: resolveCategoryCaps()
  };
};

const normalizeProvidedTrends = (
  trendCandidates: RequestBody["trendCandidates"]
): PlannedTrendItem[] => {
  return (trendCandidates ?? [])
    .map((item, index) => {
      const title = compactText(item?.title ?? "");
      if (!title) return null;

      const summary =
        compactText(item?.summary ?? "") ||
        `${title} was highlighted in recent public reports and discussions.`;
      const url = compactText(item?.url ?? "");
      return hydratePlannedTrendItem({
        id: compactText(item?.id ?? "") || `provided-${index + 1}`,
        title,
        url,
        summary,
        source: compactText(item?.source ?? "") || "unknown",
        category: compactText(item?.category ?? "") || "general",
        score: typeof item?.score === "number" && Number.isFinite(item.score) ? item.score : 0,
        publishedAt: typeof item?.publishedAt === "string" ? item.publishedAt : null,
        clusterSize:
          typeof item?.clusterSize === "number" && Number.isFinite(item.clusterSize)
            ? Math.max(1, Math.floor(item.clusterSize))
            : 1,
        normalizedHash: compactText(item?.normalizedHash ?? "")
      });
    })
    .filter((item): item is PlannedTrendItem => item !== null);
};

const toDigestSourceItems = (items: PlannedTrendItem[]): TrendDigestSourceItem[] => {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    source: item.source,
    url: item.url,
    category: item.category || "general",
    score: item.score,
    publishedAt: item.publishedAt,
    clusterSize: item.clusterSize
  }));
};

const toPlannedFromDigestItem = (item: TrendDigestItem): PlannedTrendItem => {
  return hydratePlannedTrendItem({
    id: item.id,
    title: item.cleanedTitle,
    url: item.url,
    summary: `${item.whatHappened} ${item.whyItMatters}`.trim(),
    source: item.source,
    category: item.category || "general",
    score: item.score,
    publishedAt: item.publishedAt,
    clusterSize: item.clusterSize,
    normalizedHash: normalizeHash(item.cleanedTitle, item.url, item.id)
  });
};

const mergeSelectionCandidates = (
  primary: PlannedTrendItem[],
  secondary: PlannedTrendItem[]
): PlannedTrendItem[] => {
  const merged: PlannedTrendItem[] = [];
  const seen = new Set<string>();
  for (const candidate of [...primary, ...secondary]) {
    const key = candidate.normalizedHash || normalizeHash(candidate.title, candidate.url, candidate.id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
  }
  return merged;
};

const loadSelectedTrends = async (
  lookbackHours: number,
  candidatePoolSize: number
): Promise<PlannedTrendItem[]> => {
  const sinceMs = Date.now() - lookbackHours * 60 * 60 * 1000;
  const excludedCategories = new Set(
    parseCsvList(
      Deno.env.get("TREND_EXCLUDED_CATEGORIES") ?? undefined,
      DEFAULT_EXCLUDED_SOURCE_CATEGORIES
    ).map((category) => normalizeTrendCategory(category))
  );
  const excludedKeywords = parseCsvList(
    Deno.env.get("TREND_EXCLUDED_KEYWORDS") ?? undefined,
    DEFAULT_EXCLUDED_KEYWORDS
  ).map(normalizeToken);

  const queryLimit = clamp(candidatePoolSize * 4, 80, 400);
  const { data, error } = await supabaseAdmin
    .from("trend_items")
    .select(
      "id, title, url, summary, score, published_at, cluster_size, is_cluster_representative, created_at, normalized_hash, trend_sources!inner(name,category)"
    )
    .eq("is_cluster_representative", true)
    .order("published_at", { ascending: false })
    .order("score", { ascending: false })
    .limit(queryLimit);

  if (error) throw error;

  const selected = ((data ?? []) as TrendCandidateRow[])
    .filter((row) => Boolean(row.id && row.title && row.url && row.score !== null))
    .filter((row) => row.is_cluster_representative !== false)
    .filter((row) => {
      const dateValue = row.published_at ?? row.created_at;
      if (!dateValue) return false;
      const rowMs = Date.parse(dateValue);
      if (Number.isNaN(rowMs) || rowMs < sinceMs) return false;

      const category = normalizeTrendCategory(resolveCategory(row));
      if (excludedCategories.has(category)) return false;

      const haystack = `${row.title ?? ""} ${row.summary ?? ""} ${row.url ?? ""}`.toLowerCase();
      return !excludedKeywords.some((keyword) => haystack.includes(keyword));
    })
    .map((row) =>
      hydratePlannedTrendItem({
        id: row.id as string,
        title: compactText(row.title as string),
        url: compactText(row.url as string),
        summary:
          compactText(row.summary ?? "") ||
          `${compactText(row.title as string)} was highlighted in recent public reports and discussions.`,
        source: resolveSourceName(row),
        category: compactText(resolveCategory(row)),
        score: row.score as number,
        publishedAt: row.published_at,
        clusterSize: Math.max(row.cluster_size ?? 1, 1),
        normalizedHash: compactText(row.normalized_hash ?? "")
      })
    )
    .sort((left, right) => {
      const byPublishedAt = (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
      if (byPublishedAt !== 0) return byPublishedAt;
      if (right.score !== left.score) return right.score - left.score;
      if (right.clusterSize !== left.clusterSize) return right.clusterSize - left.clusterSize;
      return right.title.localeCompare(left.title);
    });

  // Keep a wider pool so required categories (ex: movie) can still be guaranteed
  // even when the highest-scoring slice is dominated by one or two categories.
  return selected;
};

const canUseCategory = (
  item: PlannedTrendItem,
  categoryCounts: Map<string, number>,
  categoryCaps: Record<string, number>
): boolean => {
  const category = normalizeTrendCategory(item.category || "general");
  const cap = categoryCaps[category];
  if (cap === undefined) return true;
  const count = categoryCounts.get(category) ?? 0;
  return count < cap;
};

const selectTrendItemsForPlan = (
  candidates: PlannedTrendItem[],
  config: TrendSelectionConfig
): {
  selected: PlannedTrendItem[];
  audit: TrendSelectionAudit;
} => {
  const deduped: PlannedTrendItem[] = [];
  const seenHash = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.normalizedHash || normalizeHash(candidate.title, candidate.url, candidate.id);
    if (seenHash.has(key)) continue;
    seenHash.add(key);
    deduped.push(candidate);
  }

  const selected: PlannedTrendItem[] = [];
  const selectedHash = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();
  let hardCount = 0;
  let entertainmentCount = 0;
  let usedFallbackItems = 0;

  const recentDomainConflict = (domain: string): boolean => {
    if (!domain || domain === "unknown") return false;
    if (config.sourceDiversityWindow <= 1) return false;
    const recent = selected.slice(-config.sourceDiversityWindow).map((item) => item.domain);
    return recent.includes(domain);
  };

  const addSelection = (item: PlannedTrendItem): void => {
    const normalizedHash = item.normalizedHash || normalizeHash(item.title, item.url, item.id);
    selected.push(item);
    selectedHash.add(normalizedHash);
    const category = normalizeTrendCategory(item.category || "general");
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    domainCounts.set(item.domain, (domainCounts.get(item.domain) ?? 0) + 1);
    if (item.isHardTopic) hardCount += 1;
    if (item.isEntertainmentTopic) entertainmentCount += 1;
  };

  const shouldSelect = (
    item: PlannedTrendItem,
    options: {
      enforceDiversity: boolean;
      enforceHardLimit: boolean;
      enforceCategoryCap: boolean;
    }
  ): boolean => {
    const normalizedHash = item.normalizedHash || normalizeHash(item.title, item.url, item.id);
    if (selectedHash.has(normalizedHash)) return false;
    if (options.enforceCategoryCap && !canUseCategory(item, categoryCounts, config.categoryCaps)) return false;
    if (options.enforceHardLimit && item.isHardTopic && hardCount >= config.maxHardTopics) return false;
    if (options.enforceDiversity && recentDomainConflict(item.domain)) return false;
    return true;
  };

  const entertainmentCandidates = deduped.filter((item) => item.isEntertainmentTopic);
  const generalCandidates = deduped;
  const byCategory = new Map<string, PlannedTrendItem[]>();
  for (const item of entertainmentCandidates) {
    const category = normalizeTrendCategory(item.category);
    const current = byCategory.get(category) ?? [];
    current.push(item);
    byCategory.set(category, current);
  }

  for (const requiredCategory of REQUIRED_ENTERTAINMENT_CATEGORIES) {
    if (selected.length >= config.targetTotal) break;
    const candidatesForRequiredCategory = byCategory.get(requiredCategory) ?? [];
    const candidate =
      candidatesForRequiredCategory.find((item) =>
        shouldSelect(item, { enforceDiversity: true, enforceHardLimit: true, enforceCategoryCap: true })
      ) ??
      candidatesForRequiredCategory.find((item) =>
        shouldSelect(item, { enforceDiversity: false, enforceHardLimit: true, enforceCategoryCap: true })
      );
    if (candidate) {
      addSelection(candidate);
    }
  }

  for (const item of entertainmentCandidates) {
    if (selected.length >= config.targetTotal) break;
    if (entertainmentCount >= config.minEntertainment) break;
    if (!shouldSelect(item, { enforceDiversity: true, enforceHardLimit: true, enforceCategoryCap: true })) continue;
    addSelection(item);
  }

  for (const item of generalCandidates) {
    if (selected.length >= config.targetTotal) break;
    if (!shouldSelect(item, { enforceDiversity: true, enforceHardLimit: true, enforceCategoryCap: true })) continue;
    addSelection(item);
  }

  for (const item of entertainmentCandidates) {
    if (selected.length >= config.targetTotal) break;
    if (entertainmentCount >= config.minEntertainment) break;
    if (!shouldSelect(item, { enforceDiversity: false, enforceHardLimit: true, enforceCategoryCap: true })) continue;
    addSelection(item);
  }

  for (const item of generalCandidates) {
    if (selected.length >= config.targetTotal) break;
    if (!shouldSelect(item, { enforceDiversity: false, enforceHardLimit: true, enforceCategoryCap: true })) continue;
    addSelection(item);
  }

  for (const item of entertainmentCandidates) {
    if (selected.length >= config.targetTotal) break;
    if (!shouldSelect(item, { enforceDiversity: false, enforceHardLimit: true, enforceCategoryCap: false })) continue;
    addSelection(item);
  }

  for (const item of generalCandidates) {
    if (selected.length >= config.targetTotal) break;
    if (!shouldSelect(item, { enforceDiversity: false, enforceHardLimit: true, enforceCategoryCap: false })) continue;
    addSelection(item);
  }

  let fallbackCursor = 0;
  while (selected.length < config.targetTotal) {
    const fallbackBase =
      entertainmentCount < config.minEntertainment
        ? fallbackTrendItems[fallbackCursor % 3]
        : fallbackTrendItems[fallbackCursor % fallbackTrendItems.length];
    const fallback = hydratePlannedTrendItem({
      ...fallbackBase,
      id: `${fallbackBase.id}-${fallbackCursor + 1}`,
      normalizedHash: `${fallbackBase.normalizedHash}-${fallbackCursor + 1}`
    });
    fallbackCursor += 1;
    if (fallback.isHardTopic && hardCount >= config.maxHardTopics) {
      continue;
    }
    addSelection(fallback);
    usedFallbackItems += 1;
  }

  const categoryDistribution: Record<string, number> = {};
  for (const [category, count] of categoryCounts.entries()) {
    categoryDistribution[category] = count;
  }
  const domainDistribution: Record<string, number> = {};
  for (const [domain, count] of domainCounts.entries()) {
    domainDistribution[domain] = count;
  }

  return {
    selected,
    audit: {
      targetTotal: config.targetTotal,
      targetDeepDive: config.targetDeepDive,
      targetQuickNews: config.targetQuickNews,
      maxHardTopics: config.maxHardTopics,
      minEntertainment: config.minEntertainment,
      sourceDiversityWindow: config.sourceDiversityWindow,
      selectedTotal: selected.length,
      selectedHard: hardCount,
      selectedEntertainment: entertainmentCount,
      usedFallbackItems,
      categoryDistribution,
      domainDistribution,
      categoryCaps: config.categoryCaps
    }
  };
};

const withFallbackTrends = (items: PlannedTrendItem[], targetCount: number): PlannedTrendItem[] => {
  if (items.length >= targetCount) return items;

  const expanded = [...items];
  let fallbackIndex = 0;
  while (expanded.length < targetCount) {
    const fallback = fallbackTrendItems[fallbackIndex % fallbackTrendItems.length];
    expanded.push(
      hydratePlannedTrendItem({
        ...fallback,
        id: `${fallback.id}-${fallbackIndex + 1}`,
        normalizedHash: `${fallback.normalizedHash}-${fallbackIndex + 1}`
      })
    );
    fallbackIndex += 1;
  }
  return expanded;
};

const buildProgramPlan = (episodeDate: string, trendItems: PlannedTrendItem[]): ProgramPlan => {
  const pool = withFallbackTrends(trendItems, PROGRAM_REQUIRED_TRENDS);
  const mainItems = pool.slice(0, PROGRAM_MAIN_TOPICS_COUNT);
  const quickNewsItems = pool.slice(
    PROGRAM_MAIN_TOPICS_COUNT,
    PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT
  );
  const smallTalkItems = pool.slice(
    PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT,
    PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT + PROGRAM_SMALL_TALK_COUNT
  );

  return {
    role: "editor-in-chief",
    main_topics: mainItems.map((item, index) => ({
      title: item.title,
      source: item.source,
      category: item.category || "general",
      intro: `${index + 1}本目のメイントピックです。${item.title}を起点に、今日の論点を短期と中期の両方で整理します。`,
      background: `背景としては、${summarizeText(item.summary, 180)}。一次情報では、関係者の発言と公開資料の更新タイミングが噛み合い、短期間で注目が拡大しました。`,
      impact: `影響は実務面と生活面の両方に及びます。政策・プロダクト・利用者行動のどこに変化圧力がかかるのかを分解し、判断を急ぎすぎない姿勢で整理します。`,
      supplement: `補足として、出典カテゴリは「${item.category || "general"}」、主な参照媒体は「${item.source}」です。断定よりも比較で理解するため、類似事例と反証可能性も併せて確認します。`
    })),
    quick_news: quickNewsItems.map((item) => ({
      title: item.title,
      source: item.source,
      category: item.category || "general",
      summary: summarizeText(item.summary, 120),
      durationSecTarget: 30
    })),
    small_talk: smallTalkItems.map((item, index) => ({
      title: item.title,
      mood: index % 2 === 0 ? "calm" : "light",
      talkingPoint: `${item.title}をきっかけに、リスナーの体験に引き寄せて短く会話します。${summarizeText(item.summary, 80)}`
    })),
    letters: {
      host_prompt:
        "お便りは結論を急がず、共感と次の行動が両立する返答を優先します。個別助言は避け、番組全体に有益な学びへ要約します。"
    },
    ending: {
      message: `${episodeDate}回の締めです。重要論点の再確認と、次回の深掘り予告を一言で提示して終わります。`
    }
  };
};

const buildCompatTopic = (
  episodeDate: string,
  programPlan: ProgramPlan,
  digestItems: TrendDigestItem[]
): Topic => {
  const digestTitle = digestItems
    .slice(0, 2)
    .map((item) => summarizeText(item.cleanedTitle, 26))
    .join(" / ");
  const mainTitles = programPlan.main_topics.map((item) => summarizeText(item.title, 28)).join(" / ");
  const quickNewsTitles = digestItems
    .slice(0, 2)
    .map((item, index) => `クイック${index + 1}: ${summarizeText(item.cleanedTitle, 26)}`);
  const digestBullets = digestItems
    .slice(0, 3)
    .map(
      (item, index) =>
        `メイントピック${index + 1}: ${summarizeText(item.cleanedTitle, 42)} / ${summarizeText(item.whyItMatters, 42)}`
    );

  return {
    title: digestTitle || mainTitles || `Daily Topic ${episodeDate}`,
    bullets: [
      ...(digestBullets.length > 0
        ? digestBullets
        : programPlan.main_topics.map(
            (item, index) => `メイントピック${index + 1}: ${summarizeText(item.title, 42)}`
          )),
      ...quickNewsTitles,
      "レターズ: リスナーからのメッセージに番組として回答します。",
      "エンディング: 次回の予告と視点の持ち帰りを整理します。"
    ]
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const selectionConfig = resolveSelectionConfig();
  const digestConfig = resolveTrendDigestConfigFromRaw({
    denyKeywords: Deno.env.get("TREND_DENY_KEYWORDS") ?? undefined,
    allowCategories: Deno.env.get("TREND_ALLOW_CATEGORIES") ?? undefined,
    maxHardNews: Deno.env.get("TREND_MAX_HARD_TOPICS") ?? Deno.env.get("TREND_MAX_HARD_NEWS") ?? undefined,
    maxItems: `${selectionConfig.candidatePoolSize}`
  });

  const runId = await startRun("plan-topics", {
    step: "plan-topics",
    role: "editor-in-chief",
    episodeDate,
    idempotencyKey,
    selectionConfig,
    digestConfig
  });

  try {
    let loadedCandidates: PlannedTrendItem[] = normalizeProvidedTrends(body.trendCandidates);
    let usedTrendFallback = false;
    let trendFallbackReason: string | null = null;
    let trendLoadError: string | null = null;

    if (loadedCandidates.length === 0) {
      try {
        loadedCandidates = await loadSelectedTrends(
          selectionConfig.lookbackHours,
          selectionConfig.candidatePoolSize
        );
        if (loadedCandidates.length === 0) {
          usedTrendFallback = true;
          trendFallbackReason = "no_recent_trends";
        }
      } catch (error) {
        usedTrendFallback = true;
        trendFallbackReason = "trend_query_failed";
        trendLoadError = error instanceof Error ? error.message : String(error);
      }
    }

    const digestBaseItems = usedTrendFallback ? [...fallbackTrendItems] : loadedCandidates;
    let digestResult = buildTrendDigest(toDigestSourceItems(digestBaseItems), digestConfig);
    if (digestResult.items.length === 0) {
      usedTrendFallback = true;
      trendFallbackReason = trendFallbackReason ?? "digest_filtered_all";
      digestResult = buildTrendDigest(toDigestSourceItems(fallbackTrendItems), {
        ...digestConfig,
        allowCategories: [],
        denyKeywords: []
      });
    }

    const digestedTrendItems = digestResult.items.map(toPlannedFromDigestItem);
    const selectionPool = mergeSelectionCandidates(digestedTrendItems, digestBaseItems);
    const selectedPlanTrends = selectTrendItemsForPlan(
      selectionPool.length > 0 ? selectionPool : fallbackTrendItems,
      selectionConfig
    );
    const trendItemsForScript = withFallbackTrends(
      selectedPlanTrends.selected,
      Math.max(PROGRAM_REQUIRED_TRENDS, selectionConfig.targetTotal)
    );
    const programPlan = buildProgramPlan(episodeDate, trendItemsForScript);
    const topic = buildCompatTopic(episodeDate, programPlan, digestResult.items);
    const selectedTrendAudit = selectedPlanTrends.selected.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      category: item.category,
      score: item.score,
      publishedAt: item.publishedAt,
      clusterSize: item.clusterSize
    }));

    await finishRun(runId, {
      step: "plan-topics",
      role: "editor-in-chief",
      episodeDate,
      idempotencyKey,
      topic,
      programPlan,
      selectionConfig,
      usedTrendFallback,
      trendFallbackReason,
      trendLoadError,
      trendItems: trendItemsForScript,
      selectedTrendItems: selectedTrendAudit,
      trendDigest: digestResult.items,
      trendSelectionSummary: selectedPlanTrends.audit,
      digest_used_count: digestResult.usedCount,
      digest_filtered_count: digestResult.filteredCount,
      digest_category_distribution: digestResult.categoryDistribution,
      digestConfig
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      role: "editor-in-chief",
      topic,
      programPlan,
      usedTrendFallback,
      trendFallbackReason,
      trendItems: trendItemsForScript,
      selectedTrendItems: selectedTrendAudit,
      trendSelectionSummary: selectedPlanTrends.audit,
      trendDigest: digestResult.items,
      digestUsedCount: digestResult.usedCount,
      digestFilteredCount: digestResult.filteredCount,
      digestCategoryDistribution: digestResult.categoryDistribution
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "plan-topics",
      role: "editor-in-chief",
      episodeDate,
      idempotencyKey,
      selectionConfig,
      digestConfig
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
