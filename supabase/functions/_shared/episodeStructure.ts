export type EpisodeStructureConfig = {
  deepDiveCount: number;
  quickNewsCount: number;
  totalTargetChars: number;
  minCharsWithTolerance: number;
  maxCharsWithTolerance: number;
};

export type EpisodeItemsUsedCount = {
  deepdive: number;
  quicknews: number;
  letters: number;
};

export type EpisodeScriptQualityViolation =
  | "target_chars_not_met"
  | "quicknews_count_mismatch"
  | "contains_banned_token";

export type EpisodeScriptQualityResult = {
  ok: boolean;
  violations: EpisodeScriptQualityViolation[];
  metrics: {
    actualChars: number;
    minCharsWithTolerance: number;
    maxCharsWithTolerance: number;
    quicknewsExpected: number;
    quicknewsActual: number;
    bannedTokenHits: string[];
  };
};

const DEFAULT_DEEPDIVE_COUNT = 3;
const DEFAULT_QUICKNEWS_COUNT = 6;
const DEFAULT_TOTAL_TARGET_CHARS = 4600;
const MIN_DEEPDIVE_COUNT = 1;
const MAX_DEEPDIVE_COUNT = 4;
const MIN_QUICKNEWS_COUNT = 1;
const MAX_QUICKNEWS_COUNT = 12;
const MIN_TOTAL_TARGET_CHARS = 1200;
const MAX_TOTAL_TARGET_CHARS = 12000;
const MIN_TOLERANCE_RATIO = 0.85;
const MAX_TOLERANCE_RATIO = 2.6;

const BANNED_SCRIPT_TOKENS = ["http", "<a", "&#", "#8217", "数式"];
const SOURCES_SECTION_PATTERN = /\[SOURCES(?:_FOR_UI)?\][\s\S]*?(?=\n\[[^\]]+\]\s*\n?|$)/gi;

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const resolveEpisodeStructureConfigFromRaw = (raw: {
  deepDiveCount?: string;
  quickNewsCount?: string;
  totalTargetChars?: string;
}): EpisodeStructureConfig => {
  const deepDiveCount = clamp(
    parsePositiveInt(raw.deepDiveCount, DEFAULT_DEEPDIVE_COUNT),
    MIN_DEEPDIVE_COUNT,
    MAX_DEEPDIVE_COUNT
  );
  const quickNewsCount = clamp(
    parsePositiveInt(raw.quickNewsCount, DEFAULT_QUICKNEWS_COUNT),
    MIN_QUICKNEWS_COUNT,
    MAX_QUICKNEWS_COUNT
  );
  const totalTargetChars = clamp(
    parsePositiveInt(raw.totalTargetChars, DEFAULT_TOTAL_TARGET_CHARS),
    MIN_TOTAL_TARGET_CHARS,
    MAX_TOTAL_TARGET_CHARS
  );

  return {
    deepDiveCount,
    quickNewsCount,
    totalTargetChars,
    minCharsWithTolerance: Math.round(totalTargetChars * MIN_TOLERANCE_RATIO),
    maxCharsWithTolerance: Math.round(totalTargetChars * MAX_TOLERANCE_RATIO)
  };
};

export const validateEpisodeScriptQuality = (params: {
  script: string;
  itemsUsedCount: EpisodeItemsUsedCount;
  config: EpisodeStructureConfig;
}): EpisodeScriptQualityResult => {
  const script = params.script.trim();
  const scriptWithoutSources = script.replace(SOURCES_SECTION_PATTERN, " ");
  const actualChars = script.length;
  const bannedTokenHits = BANNED_SCRIPT_TOKENS.filter((token) =>
    scriptWithoutSources.toLowerCase().includes(token.toLowerCase())
  );

  const violations: EpisodeScriptQualityViolation[] = [];
  if (
    actualChars < params.config.minCharsWithTolerance ||
    actualChars > params.config.maxCharsWithTolerance
  ) {
    violations.push("target_chars_not_met");
  }
  if (params.itemsUsedCount.quicknews !== params.config.quickNewsCount) {
    violations.push("quicknews_count_mismatch");
  }
  if (bannedTokenHits.length > 0) {
    violations.push("contains_banned_token");
  }

  return {
    ok: violations.length === 0,
    violations,
    metrics: {
      actualChars,
      minCharsWithTolerance: params.config.minCharsWithTolerance,
      maxCharsWithTolerance: params.config.maxCharsWithTolerance,
      quicknewsExpected: params.config.quickNewsCount,
      quicknewsActual: params.itemsUsedCount.quicknews,
      bannedTokenHits
    }
  };
};
