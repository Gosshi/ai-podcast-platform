export type TrendIngestConfig = {
  maxItemsTotal: number;
  maxItemsPerSource: number;
  requirePublishedAt: boolean;
  categoryWeights: Record<string, number>;
};

export type TrendScoreInput = {
  publishedAt: string;
  sourceWeight: number;
  sourceCategory: string;
  clusterSize: number;
  diversityBonus: number;
  entertainmentFloorBonus: number;
  sourceReliabilityBonus: number;
  duplicatePenalty: number;
  hasClickbaitKeyword: boolean;
  hasSensitiveHardKeyword: boolean;
  hasOverheatedKeyword: boolean;
  entertainmentBonusValue: number;
  categoryWeights: Record<string, number>;
};

export type TrendScoreBreakdown = {
  score: number;
  scoreFreshness: number;
  scoreSource: number;
  scoreBonus: number;
  scorePenalty: number;
  categoryWeight: number;
  hardNewsPenalty: number;
  hardKeywordPenalty: number;
  overheatedPenalty: number;
  duplicatePenalty: number;
};

export type TrendCapsResult<T> = {
  selected: T[];
  droppedTotalCount: number;
  droppedPerSourceCount: number;
};

const FRESHNESS_HALF_LIFE_HOURS = 20;
const MAX_FRESHNESS_WINDOW_HOURS = 72;

const DEFAULT_MAX_ITEMS_TOTAL = 60;
const DEFAULT_MAX_ITEMS_PER_SOURCE = 10;
const MIN_MAX_ITEMS_TOTAL = 1;
const MAX_MAX_ITEMS_TOTAL = 300;
const MIN_MAX_ITEMS_PER_SOURCE = 1;
const MAX_MAX_ITEMS_PER_SOURCE = 50;
const HARD_NEWS_PENALTY = 0.28;
const HARD_KEYWORD_PENALTY = 0.65;
const OVERHEATED_PENALTY = 0.32;

const HARD_NEWS_CATEGORIES = new Set([
  "news",
  "politics",
  "policy",
  "government",
  "election",
  "world",
  "economy",
  "business"
]);

export const DEFAULT_TREND_CATEGORY_WEIGHTS: Record<string, number> = {
  general: 1,
  tech: 1.04,
  ai: 1.05,
  startup: 1.02,
  science: 0.98,
  news: 0.92,
  politics: 0.85,
  policy: 0.9,
  world: 0.9,
  economy: 0.9,
  business: 0.93,
  entertainment: 1.26,
  culture: 1.18,
  gadgets: 1.24,
  lifestyle: 1.16,
  food: 1.12,
  travel: 1.12,
  books: 1.14,
  sports: 1.08,
  music: 1.26,
  movie: 1.24,
  anime: 1.3,
  game: 1.28,
  gaming: 1.28,
  video: 1.2,
  youtube: 1.2,
  streaming: 1.18,
  celebrity: 1.14
};

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const parseIntWithBounds = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const parseBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseCategoryWeights = (raw: string | undefined): Record<string, number> => {
  if (!raw) {
    return { ...DEFAULT_TREND_CATEGORY_WEIGHTS };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_TREND_CATEGORY_WEIGHTS };
    }

    const weights: Record<string, number> = { ...DEFAULT_TREND_CATEGORY_WEIGHTS };
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const normalizedKey = normalizeToken(key);
      if (!normalizedKey) continue;
      weights[normalizedKey] = clamp(value, 0.2, 3);
    }
    return weights;
  } catch {
    return { ...DEFAULT_TREND_CATEGORY_WEIGHTS };
  }
};

const resolveFreshnessScore = (publishedAt: string): number => {
  const baseline = new Date(publishedAt);
  if (Number.isNaN(baseline.getTime())) return 0;

  const diffMs = Math.max(0, Date.now() - baseline.getTime());
  const ageHours = Math.min(diffMs / (60 * 60 * 1000), MAX_FRESHNESS_WINDOW_HOURS);
  const decay = Math.exp((-Math.log(2) * ageHours) / FRESHNESS_HALF_LIFE_HOURS);
  return decay * 2;
};

export const resolveCategoryWeight = (
  sourceCategory: string,
  categoryWeights: Record<string, number>
): number => {
  const normalized = normalizeToken(sourceCategory);
  if (normalized && normalized in categoryWeights) {
    return categoryWeights[normalized];
  }
  return categoryWeights.general ?? 1;
};

export const resolveTrendIngestConfigFromRaw = (raw: {
  maxItemsTotal?: string;
  maxItemsPerSource?: string;
  requirePublishedAt?: string;
  categoryWeights?: string;
}): TrendIngestConfig => {
  return {
    maxItemsTotal: parseIntWithBounds(
      raw.maxItemsTotal,
      DEFAULT_MAX_ITEMS_TOTAL,
      MIN_MAX_ITEMS_TOTAL,
      MAX_MAX_ITEMS_TOTAL
    ),
    maxItemsPerSource: parseIntWithBounds(
      raw.maxItemsPerSource,
      DEFAULT_MAX_ITEMS_PER_SOURCE,
      MIN_MAX_ITEMS_PER_SOURCE,
      MAX_MAX_ITEMS_PER_SOURCE
    ),
    requirePublishedAt: parseBoolean(raw.requirePublishedAt, true),
    categoryWeights: parseCategoryWeights(raw.categoryWeights)
  };
};

export const resolveRequestedPerSourceLimit = (
  requested: number | undefined,
  maxItemsPerSource: number
): number => {
  const parsed = typeof requested === "number" ? requested : maxItemsPerSource;
  if (!Number.isFinite(parsed)) return maxItemsPerSource;
  return clamp(Math.floor(parsed), MIN_MAX_ITEMS_PER_SOURCE, maxItemsPerSource);
};

export const calculateTrendScore = (params: TrendScoreInput): TrendScoreBreakdown => {
  const freshness = resolveFreshnessScore(params.publishedAt);
  const categoryWeight = resolveCategoryWeight(params.sourceCategory, params.categoryWeights);
  const weightedSource = Math.max(params.sourceWeight, 0) * categoryWeight;
  const clusterSizeBonus = Math.log2(Math.max(params.clusterSize, 1));
  const categoryWeightBonus = Math.max(categoryWeight - 1, 0);
  const categoryWeightPenalty = Math.max(1 - categoryWeight, 0) * 0.6;
  const hardNewsPenalty = HARD_NEWS_CATEGORIES.has(normalizeToken(params.sourceCategory)) &&
      categoryWeight <= 1
    ? HARD_NEWS_PENALTY
    : 0;
  const clickbaitPenalty = params.hasClickbaitKeyword ? 1.1 : 0;
  const hardKeywordPenalty = params.hasSensitiveHardKeyword ? HARD_KEYWORD_PENALTY : 0;
  const overheatedPenalty = params.hasOverheatedKeyword ? OVERHEATED_PENALTY : 0;

  // Score model:
  // - freshness + source quality is the base
  // - diversity/entertainment floor/reliable source bonuses keep mix enjoyable
  // - penalties suppress clickbait, hard-news overload, and repeated same-type items
  const bonusScore =
    clusterSizeBonus +
    params.diversityBonus +
    params.entertainmentFloorBonus +
    params.sourceReliabilityBonus +
    params.entertainmentBonusValue +
    categoryWeightBonus;
  const penaltyScore =
    clickbaitPenalty +
    categoryWeightPenalty +
    hardNewsPenalty +
    hardKeywordPenalty +
    overheatedPenalty +
    Math.max(params.duplicatePenalty, 0);
  const raw = freshness + weightedSource + bonusScore - penaltyScore;

  return {
    score: Number(raw.toFixed(6)),
    scoreFreshness: Number(freshness.toFixed(6)),
    scoreSource: Number(weightedSource.toFixed(6)),
    scoreBonus: Number(bonusScore.toFixed(6)),
    scorePenalty: Number(penaltyScore.toFixed(6)),
    categoryWeight: Number(categoryWeight.toFixed(6)),
    hardNewsPenalty: Number(hardNewsPenalty.toFixed(6)),
    hardKeywordPenalty: Number(hardKeywordPenalty.toFixed(6)),
    overheatedPenalty: Number(overheatedPenalty.toFixed(6)),
    duplicatePenalty: Number(Math.max(params.duplicatePenalty, 0).toFixed(6))
  };
};

export const applyTrendCaps = <T extends { item: { sourceId: string } }>(
  rankedItems: T[],
  params: {
    maxItemsTotal: number;
    maxItemsPerSource: number;
  }
): TrendCapsResult<T> => {
  const selected: T[] = [];
  const perSourceCount = new Map<string, number>();
  let droppedTotalCount = 0;
  let droppedPerSourceCount = 0;

  for (const entry of rankedItems) {
    if (selected.length >= params.maxItemsTotal) {
      droppedTotalCount += 1;
      continue;
    }

    const sourceId = entry.item.sourceId;
    const current = perSourceCount.get(sourceId) ?? 0;
    if (current >= params.maxItemsPerSource) {
      droppedPerSourceCount += 1;
      continue;
    }

    perSourceCount.set(sourceId, current + 1);
    selected.push(entry);
  }

  return { selected, droppedTotalCount, droppedPerSourceCount };
};
