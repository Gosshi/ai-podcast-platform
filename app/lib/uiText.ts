import {
  FRAME_TYPE_LABELS,
  GENRE_LABELS,
  JUDGMENT_TYPE_BADGE_LABELS
} from "@/src/lib/labels";
import { formatEpisodeTitle, formatTopicTitle } from "@/src/lib/episodeTitles";

export const JUDGMENT_TYPE_LABELS = JUDGMENT_TYPE_BADGE_LABELS;

export const WATCHLIST_STATUS_LABELS = {
  saved: "保存済み",
  watching: "保存済み",
  archived: "見送り"
} as const;

export const URGENCY_LABELS = {
  overdue: "期限切れ",
  due_soon: "まもなく期限",
  no_deadline: "期限なし"
} as const;

const JAPANESE_TEXT_RE = /[\u3040-\u30ff\u3400-\u9fff]/u;

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const hasJapaneseText = (value: string): boolean => JAPANESE_TEXT_RE.test(value);

export const formatFrameTypeLabel = (value: string | null, fallback = "未設定"): string => {
  if (!value) {
    return fallback;
  }

  return FRAME_TYPE_LABELS[value] ?? value;
};

const resolveGenreFromKeywords = (value: string): string | null => {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("subscription") ||
    normalized.includes("streaming") ||
    normalized.includes("netflix") ||
    normalized.includes("prime") ||
    normalized.includes("disney") ||
    normalized.includes("spotify") ||
    normalized.includes("youtube")
  ) {
    return "サブスク";
  }

  if (
    normalized.includes("tool") ||
    normalized.includes("workspace") ||
    normalized.includes("notion") ||
    normalized.includes("chatgpt") ||
    normalized.includes("assistant")
  ) {
    return "ツール";
  }

  if (
    normalized.includes("tech") ||
    normalized.includes("technology") ||
    normalized.includes("api") ||
    normalized.includes("model") ||
    normalized.includes("gpu")
  ) {
    return "テック";
  }

  if (
    normalized.includes("life") ||
    normalized.includes("travel") ||
    normalized.includes("routine") ||
    normalized.includes("task")
  ) {
    return "生活";
  }

  if (
    normalized.includes("movie") ||
    normalized.includes("anime") ||
    normalized.includes("game") ||
    normalized.includes("entertainment")
  ) {
    return "エンタメ";
  }

  return null;
};

export const formatGenreLabel = (value: string | null, fallback = "カテゴリ未設定"): string => {
  if (!value) {
    return fallback;
  }

  const normalized = normalizeText(value).toLowerCase();
  if (normalized.length === 0) {
    return fallback;
  }

  if (hasJapaneseText(normalized)) {
    return value;
  }

  return GENRE_LABELS[normalized] ?? resolveGenreFromKeywords(normalized) ?? value;
};

export { formatEpisodeTitle, formatTopicTitle };
