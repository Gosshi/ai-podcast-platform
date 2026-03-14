import type { JudgmentType } from "@/src/lib/judgmentCards";

export const JUDGMENT_TYPE_LABELS: Record<JudgmentType, string> = {
  use_now: "今すぐ見る",
  watch: "あとで判断",
  skip: "見送る"
};

export const WATCHLIST_STATUS_LABELS = {
  saved: "保存",
  watching: "保存",
  archived: "見送る"
} as const;

export const URGENCY_LABELS = {
  overdue: "期限切れ",
  due_soon: "まもなく期限",
  no_deadline: "期限なし"
} as const;

const FRAME_TYPE_LABELS: Record<string, string> = {
  "Frame A": "使う時間で判断",
  "Frame B": "月額の見直し",
  "Frame C": "セール時の判断",
  "Frame D": "広告負担の見直し"
};

const GENRE_LABELS: Record<string, string> = {
  games: "ゲーム",
  streaming: "動画配信",
  anime: "アニメ",
  movies: "映画",
  movie: "映画",
  tech: "テック",
  entertainment: "エンタメ",
  general: "総合",
  travel: "旅行"
};

const EPISODE_TITLE_MAP: Record<string, string> = {
  "Streaming Triage: ad-free, catch-up, and duplicates": "配信サービス整理",
  "Anime Weekend Window: event tickets, backlog, and season passes": "アニメ視聴の見直し",
  "Movie And Subscription Cleanup: catalog rotation decisions": "配信終了前チェック",
  "Game Pass Or Sale? Weekend playtime budgeting": "週末ゲーム整理"
};

const TOPIC_TITLE_MAP: Record<string, string> = {
  "Ad-free plan comparison": "広告プラン比較",
  "Streaming cleanup": "配信サービス整理",
  "Catalog rotation check": "配信終了前チェック"
};

const JAPANESE_TEXT_RE = /[\u3040-\u30ff\u3400-\u9fff]/u;

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const hasJapaneseText = (value: string): boolean => JAPANESE_TEXT_RE.test(value);

const resolveKeywordTitle = (value: string): string | null => {
  const normalized = value.toLowerCase();

  if (normalized.includes("ad-free") || normalized.includes("duplicates") || normalized.includes("streaming")) {
    return "配信サービス整理";
  }

  if (normalized.includes("catalog") || normalized.includes("subscription cleanup") || normalized.includes("movie")) {
    return "配信終了前チェック";
  }

  if (normalized.includes("anime") || normalized.includes("backlog") || normalized.includes("season pass")) {
    return "アニメ視聴の見直し";
  }

  if (normalized.includes("game pass") || normalized.includes("weekend playtime") || normalized.includes("sale")) {
    return "週末ゲーム整理";
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

export const formatGenreLabel = (value: string | null, fallback = "配信作品"): string => {
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

  return GENRE_LABELS[normalized] ?? value;
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

export const formatTopicTitle = (value: string | null, fallback = "判断メモ"): string => {
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

  return TOPIC_TITLE_MAP[normalized] ?? resolveKeywordTitle(normalized) ?? "視聴判断メモ";
};
