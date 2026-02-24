export type ScriptQualityMetrics = {
  charLength: number;
  duplicateRatio: number;
  duplicateLineCount: number;
};

export type ScriptQualityViolation =
  | "contains_lt"
  | "contains_http"
  | "contains_html_entity"
  | "contains_math_token"
  | "duplicate_ratio_exceeded"
  | "too_short";

export type ScriptQualityResult = {
  ok: boolean;
  violations: ScriptQualityViolation[];
  metrics: ScriptQualityMetrics;
};

const DEFAULT_MIN_CHARS = 2000;
const DEFAULT_MAX_DUPLICATE_RATIO = 0.05;
const SOURCES_SECTION_PATTERN = /\[SOURCES(?:_FOR_UI)?\][\s\S]*?(?=\n\[[^\]]+\]\s*\n?|$)/gi;

const normalizeLine = (line: string): string => {
  return line
    .trim()
    .toLowerCase()
    .replace(/[\s\t]+/g, " ")
    .replace(/[、。,.!?！？:;\-—~…・"'`]/g, "")
    .trim();
};

export const calculateDuplicateRatio = (script: string): {
  duplicateRatio: number;
  duplicateLineCount: number;
} => {
  const lines = script
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { duplicateRatio: 0, duplicateLineCount: 0 };
  }

  const seen = new Map<string, number>();
  let duplicateLineCount = 0;

  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized || normalized.length < 12) {
      continue;
    }

    const prev = seen.get(normalized) ?? 0;
    if (prev > 0) {
      duplicateLineCount += 1;
    }
    seen.set(normalized, prev + 1);
  }

  return {
    duplicateRatio: duplicateLineCount / lines.length,
    duplicateLineCount
  };
};

export const checkScriptQuality = (
  script: string,
  options?: {
    minChars?: number;
    maxDuplicateRatio?: number;
  }
): ScriptQualityResult => {
  const minChars = options?.minChars ?? DEFAULT_MIN_CHARS;
  const maxDuplicateRatio = options?.maxDuplicateRatio ?? DEFAULT_MAX_DUPLICATE_RATIO;
  const trimmed = script.trim();
  const trimmedWithoutSources = trimmed.replace(SOURCES_SECTION_PATTERN, " ");
  const charLength = trimmed.length;
  const duplicate = calculateDuplicateRatio(trimmed);

  const violations: ScriptQualityViolation[] = [];

  if (trimmedWithoutSources.includes("<")) {
    violations.push("contains_lt");
  }
  if (/http/i.test(trimmedWithoutSources)) {
    violations.push("contains_http");
  }
  if (/&#\d+;|&#x[0-9a-f]+;/i.test(trimmedWithoutSources)) {
    violations.push("contains_html_entity");
  }
  if (trimmedWithoutSources.includes("数式")) {
    violations.push("contains_math_token");
  }
  if (duplicate.duplicateRatio > maxDuplicateRatio) {
    violations.push("duplicate_ratio_exceeded");
  }
  if (charLength < minChars) {
    violations.push("too_short");
  }

  return {
    ok: violations.length === 0,
    violations,
    metrics: {
      charLength,
      duplicateRatio: duplicate.duplicateRatio,
      duplicateLineCount: duplicate.duplicateLineCount
    }
  };
};
