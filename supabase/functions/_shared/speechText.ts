import { sanitizeScriptText } from "./scriptSanitizer.ts";

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/g;
const STANDALONE_ENTITY_PATTERN = /#(?:x[0-9a-fA-F]+|\d+);?/g;
const URL_WORD_PATTERN = /\b(?:https?|www)\b/gi;
const ENGLISH_STOP_WORDS = new Set([
  "the",
  "this",
  "that",
  "with",
  "from",
  "into",
  "for",
  "and",
  "will",
  "today",
  "update",
  "news"
]);

const dedupeList = (values: string[], limit: number): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const token = value.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(token);
    if (result.length >= limit) break;
  }

  return result;
};

const normalizePunctuation = (value: string): string => {
  return value
    .replace(/。{2,}/g, "。")
    .replace(/[!！]{2,}/g, "！")
    .replace(/[?？]{2,}/g, "？")
    .replace(/\.{2,}/g, "。")
    .replace(/[、,]{2,}/g, "、")
    .replace(/\s+([、。！？!?.,])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const clipAtSentenceBoundary = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  let clipped = value.slice(0, maxChars);
  const boundary = Math.max(
    clipped.lastIndexOf("。"),
    clipped.lastIndexOf("！"),
    clipped.lastIndexOf("？"),
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? ")
  );
  if (boundary > Math.floor(maxChars * 0.6)) {
    clipped = clipped.slice(0, boundary + 1);
  }
  return `${clipped.trimEnd()}…`;
};

export const sanitizeSpeechText = (value: string, fallback = ""): string => {
  const cleaned = sanitizeScriptText(value)
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(STANDALONE_ENTITY_PATTERN, " ")
    .replace(URL_WORD_PATTERN, " ")
    .replace(/\b(?:math|equation)\b/gi, "計算式")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizePunctuation(cleaned);
  return normalized || fallback;
};

export const splitSpeechSentences = (value: string): string[] => {
  return sanitizeSpeechText(value)
    .split(/(?<=[。.!?！？])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

export const summarizeForSpeech = (
  value: string,
  options?: {
    maxSentences?: number;
    maxChars?: number;
    fallback?: string;
  }
): string => {
  const maxSentences = options?.maxSentences ?? 2;
  const maxChars = options?.maxChars ?? 240;
  const fallback = options?.fallback ?? "公開情報の更新点を整理します。";
  const sentences = splitSpeechSentences(value);
  if (sentences.length === 0) {
    return fallback;
  }

  const joined = sentences.slice(0, maxSentences).join(" ");
  return clipAtSentenceBoundary(joined, maxChars);
};

export const extractSpeechKeywords = (value: string, limit = 4): string[] => {
  const cleaned = sanitizeSpeechText(value);
  if (!cleaned) return [];

  const matches = [
    ...(cleaned.match(/\b[A-Z][A-Za-z0-9&.-]{1,}(?:\s+[A-Z][A-Za-z0-9&.-]{1,}){0,2}\b/g) ?? []),
    ...(cleaned.match(/\b[A-Z]{2,8}\d{0,3}\b/g) ?? []),
    ...(cleaned.match(/[ァ-ヶー]{2,}(?:[・ー][ァ-ヶー]{2,})?/g) ?? []),
    ...(cleaned.match(/\d+(?:\.\d+)?(?:%|％|億|万|円|ドル|社|人|件|台|年|月|日)?/g) ?? [])
  ];

  return dedupeList(
    matches.filter((token) => !ENGLISH_STOP_WORDS.has(token.toLowerCase())),
    limit
  );
};
