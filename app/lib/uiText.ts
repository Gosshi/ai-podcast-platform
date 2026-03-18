import {
  FRAME_TYPE_LABELS,
  GENRE_LABELS,
  JUDGMENT_TYPE_BADGE_LABELS
} from "@/src/lib/labels";

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

const EPISODE_TITLE_MAP: Record<string, string> = {
  "Streaming Triage: ad-free, catch-up, and duplicates": "配信サービス整理",
  "Anime Weekend Window: event tickets, backlog, and season passes": "アニメ視聴の見直し",
  "Movie And Subscription Cleanup: catalog rotation decisions": "配信終了前チェック",
  "Game Pass Or Sale? Weekend playtime budgeting": "週末ゲーム整理"
};

const TOPIC_TITLE_MAP: Record<string, string> = {
  "Ad-free plan comparison": "プラン見直し",
  "Streaming cleanup": "サブスク整理",
  "Catalog rotation check": "更新前チェック"
};

const JAPANESE_TEXT_RE = /[\u3040-\u30ff\u3400-\u9fff]/u;

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const hasJapaneseText = (value: string): boolean => JAPANESE_TEXT_RE.test(value);

const resolveKeywordTitle = (value: string): string | null => {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("ad-free") ||
    normalized.includes("duplicates") ||
    normalized.includes("streaming") ||
    normalized.includes("subscription")
  ) {
    return "サブスク整理";
  }

  if (normalized.includes("catalog") || normalized.includes("subscription cleanup") || normalized.includes("movie")) {
    return "更新前チェック";
  }

  if (normalized.includes("anime") || normalized.includes("backlog") || normalized.includes("season pass")) {
    return "エンタメ候補の見直し";
  }

  if (normalized.includes("game pass") || normalized.includes("weekend playtime") || normalized.includes("sale")) {
    return "週末の使い方を整理";
  }

  if (
    normalized.includes("gpu") ||
    normalized.includes("chatgpt") ||
    normalized.includes("ai") ||
    normalized.includes("build") ||
    normalized.includes("workflow")
  ) {
    return "使い方の見直し";
  }

  return null;
};

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

export const formatEpisodeTitle = (value: string | null, fallback = "詳細未設定"): string => {
  if (!value) {
    return fallback;
  }

  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return fallback;
  }

  if (hasJapaneseText(normalized)) {
    return normalized;
  }

  return EPISODE_TITLE_MAP[normalized] ?? resolveKeywordTitle(normalized) ?? normalized;
};

export const formatTopicTitle = (value: string | null, fallback = "トピックメモ"): string => {
  if (!value) {
    return fallback;
  }

  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return fallback;
  }

  if (hasJapaneseText(normalized)) {
    return normalized;
  }

  return TOPIC_TITLE_MAP[normalized] ?? resolveKeywordTitle(normalized) ?? "トピックカード";
};
