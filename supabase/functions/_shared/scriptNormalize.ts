export type ScriptNormalizationMetrics = {
  removedHtmlCount: number;
  decodedHtmlEntityCount: number;
  removedUrlCount: number;
  removedPlaceholderCount: number;
  dedupedLinesCount: number;
};

export type ScriptNormalizationResult = {
  text: string;
  metrics: ScriptNormalizationMetrics;
};

export type ScriptNormalizationOptions = {
  preserveSourceUrls?: boolean;
};

const HTML_TAG_PATTERN = /<[^>]+>/g;
const URL_PATTERN = /https?:\/\/[^\s)\]}>]+/gi;
const WWW_URL_PATTERN = /\bwww\.[^\s)\]}>]+/gi;
const PLACEHOLDER_PATTERNS = [
  /\{\{[^{}]+\}\}/g,
  /<<[^<>]+>>/g,
  /\b(?:TBD|TODO|PLACEHOLDER)\b/gi,
  /\b(?:SOURCE_LINK|HTTP_WORD|PERCENT_TOKEN|AI_TOKEN|MATH_TOKEN)\b/g,
  /\[(?:URL|LINK|SOURCE|PLACEHOLDER)\]/gi
] as const;

const HTML_ENTITY_PATTERN = /&(?:#x[0-9a-fA-F]+|#\d+|[a-zA-Z]{2,8});/g;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  laquo: "\"",
  raquo: "\""
};

const SOURCES_SECTION_PATTERN = /\[(SOURCES(?:_FOR_UI)?)\]([\s\S]*?)(?=\n\[[^\]]+\]\s*\n?|$)/gi;

const protectSourceUrls = (value: string): { text: string; tokenMap: Map<string, string> } => {
  let cursor = 0;
  const tokenMap = new Map<string, string>();

  const protectedText = value.replace(SOURCES_SECTION_PATTERN, (block) => {
    return block.replace(URL_PATTERN, (match) => {
      const token = `__SOURCE_URL_TOKEN_${cursor}__`;
      cursor += 1;
      tokenMap.set(token, match);
      return token;
    }).replace(WWW_URL_PATTERN, (match) => {
      const token = `__SOURCE_URL_TOKEN_${cursor}__`;
      cursor += 1;
      tokenMap.set(token, match);
      return token;
    });
  });

  return {
    text: protectedText,
    tokenMap
  };
};

const restoreProtectedUrls = (value: string, tokenMap: Map<string, string>): string => {
  let restored = value;
  for (const [token, url] of tokenMap.entries()) {
    restored = restored.replaceAll(token, url);
  }
  return restored;
};

const normalizeLineForSimilarity = (line: string): string => {
  return line
    .replace(/^(?:補足|補足ニュース|quick\s*news|quicknews|レター|letter)\s*\d+\s*[:：-]?\s*/iu, "")
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[\s\t]+/g, "")
    .replace(/[、。,.!?！？:;\-—~…・"'`]/g, "")
    .trim();
};

const normalizeWhitespace = (value: string): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

export const stripHtmlTags = (value: string): string => {
  return value
    .replace(HTML_TAG_PATTERN, " ")
    .replace(/<[^\n>]{0,280}(?=\n|$)/g, " ")
    .replace(/[<>]/g, " ");
};

export const decodeHtmlEntities = (value: string): string => {
  return value.replace(HTML_ENTITY_PATTERN, (entity) => {
    const token = entity.slice(1, -1);
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const codePoint = Number.parseInt(token.slice(2), 16);
      if (!Number.isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return entity;
    }

    if (token.startsWith("#")) {
      const codePoint = Number.parseInt(token.slice(1), 10);
      if (!Number.isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return entity;
    }

    return HTML_ENTITIES[token] ?? entity;
  });
};

export const removeUrls = (value: string): string => {
  return value.replace(URL_PATTERN, " ").replace(WWW_URL_PATTERN, " ");
};

export const removePlaceholders = (value: string): string => {
  let output = value;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    output = output.replace(pattern, " ");
  }
  output = output.replace(/数式/g, "計算式");
  return output;
};

export const dedupeSimilarLines = (
  value: string,
  options?: {
    minComparableLength?: number;
    lookBackLines?: number;
  }
): { text: string; dedupedLinesCount: number } => {
  const minComparableLength = options?.minComparableLength ?? 12;
  const lookBackLines = options?.lookBackLines ?? 200;

  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  const keptNormalized: string[] = [];
  let dedupedLinesCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") {
        kept.push("");
        keptNormalized.push("");
      }
      continue;
    }

    const normalized = normalizeLineForSimilarity(trimmed);
    if (normalized.length < minComparableLength) {
      kept.push(trimmed);
      keptNormalized.push(normalized);
      continue;
    }

    const searchStart = Math.max(0, keptNormalized.length - lookBackLines);
    let isDuplicate = false;

    for (let i = searchStart; i < keptNormalized.length; i += 1) {
      const candidate = keptNormalized[i];
      if (!candidate || candidate.length < minComparableLength) {
        continue;
      }

      if (normalized === candidate) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      dedupedLinesCount += 1;
      continue;
    }

    kept.push(trimmed);
    keptNormalized.push(normalized);
  }

  const text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, dedupedLinesCount };
};

export const normalizeScriptText = (
  value: string,
  options?: ScriptNormalizationOptions
): ScriptNormalizationResult => {
  const htmlMatches = (value.match(HTML_TAG_PATTERN)?.length ?? 0) + (value.match(/[<>]/g)?.length ?? 0);
  const entityMatches = value.match(HTML_ENTITY_PATTERN)?.length ?? 0;

  const noHtml = stripHtmlTags(value);
  const decoded = decodeHtmlEntities(noHtml);
  const protectedSource = options?.preserveSourceUrls ? protectSourceUrls(decoded) : null;
  const urlTarget = protectedSource?.text ?? decoded;

  const urlMatches = (urlTarget.match(URL_PATTERN)?.length ?? 0) + (urlTarget.match(WWW_URL_PATTERN)?.length ?? 0);
  const noUrls = removeUrls(urlTarget);

  const placeholderMatches = PLACEHOLDER_PATTERNS.reduce((count, pattern) => {
    return count + (noUrls.match(pattern)?.length ?? 0);
  }, 0) + (noUrls.match(/数式/g)?.length ?? 0);
  const noPlaceholders = removePlaceholders(noUrls);
  const restoredUrls = protectedSource ? restoreProtectedUrls(noPlaceholders, protectedSource.tokenMap) : noPlaceholders;

  const deduped = dedupeSimilarLines(normalizeWhitespace(restoredUrls));
  const text = normalizeWhitespace(deduped.text);

  return {
    text,
    metrics: {
      removedHtmlCount: htmlMatches,
      decodedHtmlEntityCount: entityMatches,
      removedUrlCount: urlMatches,
      removedPlaceholderCount: placeholderMatches,
      dedupedLinesCount: deduped.dedupedLinesCount
    }
  };
};
