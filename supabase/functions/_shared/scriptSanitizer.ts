const HTML_TAG_PATTERN = /<[^>]+>/g;
const URL_PATTERN = /https?:\/\/[^\s)\]}>]+/gi;
const WWW_URL_PATTERN = /\bwww\.[^\s)\]}>]+/gi;
const HTML_ENTITY_PATTERN = /&(?:#x[0-9a-fA-F]+|#\d+|[a-zA-Z]{2,10});|#(?:x[0-9a-fA-F]+|\d+);/g;

const PLACEHOLDER_PATTERNS = [
  /\{\{[^{}]+\}\}/g,
  /<<[^<>]+>>/g,
  /<(?:a|img|script|style)\b[^>]*>/gi,
  /<\/(?:a|img|script|style)>/gi,
  /\b(?:tbd|todo|placeholder|pending|n\/a)\b/gi,
  /\b(?:source_link|http_word|ai_token|math_token)\b/gi,
  /\[(?:url|link|source|placeholder)\]/gi,
  /(?:続きを読む|read more)\s*\.{0,3}/gi,
  /(?:確認中|編集中|未確認|under review)/gi,
  /<a\s+href/gi,
  /数式/g
] as const;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  copy: "(c)",
  reg: "(R)",
  trade: "(TM)"
};

const decodeEntityToken = (token: string): string | null => {
  const normalized = token.trim().replace(/^&/, "").replace(/;$/, "");
  if (!normalized) return null;

  if (normalized.startsWith("#x") || normalized.startsWith("#X")) {
    const value = Number.parseInt(normalized.slice(2), 16);
    return Number.isNaN(value) ? null : String.fromCodePoint(value);
  }
  if (normalized.startsWith("#")) {
    const value = Number.parseInt(normalized.slice(1), 10);
    return Number.isNaN(value) ? null : String.fromCodePoint(value);
  }

  const named = NAMED_ENTITIES[normalized.toLowerCase()];
  return named ?? null;
};

export const stripHtml = (text: string): string => {
  return text
    .replace(HTML_TAG_PATTERN, " ")
    .replace(/[<>]/g, " ");
};

export const decodeEntities = (text: string): string => {
  return text.replace(HTML_ENTITY_PATTERN, (entity) => {
    const decoded = decodeEntityToken(entity);
    return decoded ?? " ";
  });
};

export const removeUrls = (text: string): string => {
  return text
    .replace(URL_PATTERN, " ")
    .replace(WWW_URL_PATTERN, " ");
};

export const removePlaceholders = (text: string): string => {
  let output = text;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    output = output.replace(pattern, " ");
  }
  return output;
};

export const normalizeWhitespace = (text: string): string => {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const assertNoBadTokens = (
  text: string,
  badTokens: string[] = ["http://", "https://", "<a href", "数式", "アンド#8217;"]
): void => {
  const lowerText = text.toLowerCase();
  const hits = badTokens.filter((token) => lowerText.includes(token.toLowerCase()));
  if (hits.length > 0) {
    throw new Error(`bad_tokens_detected:${hits.join(",")}`);
  }
};

export const sanitizeScriptText = (text: string): string => {
  return normalizeWhitespace(removePlaceholders(removeUrls(decodeEntities(stripHtml(text)))));
};
