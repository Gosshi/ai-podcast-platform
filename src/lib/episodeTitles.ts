import type { JudgmentCard } from "./judgmentCards";

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
const GENERIC_EPISODE_TITLE_PATTERNS = [/^daily topic\b/iu, /^episode\b/iu, /^デイリートピック/iu];

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const hasJapaneseText = (value: string): boolean => JAPANESE_TEXT_RE.test(value);

const resolveKeywordTitle = (value: string): string | null => {
  const normalized = value.toLowerCase();

  if (/\b(ad-free|duplicates|streaming|subscription)\b/u.test(normalized)) {
    return "サブスク整理";
  }

  if (/\b(catalog|subscription cleanup|movie)\b/u.test(normalized)) {
    return "更新前チェック";
  }

  if (/\b(anime|backlog|season pass)\b/u.test(normalized)) {
    return "エンタメ候補の見直し";
  }

  if (/\b(game pass|weekend playtime|sale)\b/u.test(normalized)) {
    return "週末の使い方を整理";
  }

  if (/\b(gpu|chatgpt|ai|build|workflow)\b/u.test(normalized)) {
    return "使い方の見直し";
  }

  return null;
};

export const isGenericEpisodeTitle = (value: string | null | undefined): boolean => {
  if (!value) {
    return true;
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  return GENERIC_EPISODE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
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

export const resolveJapaneseEpisodeTitle = (params: {
  topicTitle: string;
  judgmentCards?: JudgmentCard[];
  episodeDate: string;
}): string => {
  const normalizedTopicTitle = normalizeText(params.topicTitle);

  if (!isGenericEpisodeTitle(normalizedTopicTitle)) {
    return formatEpisodeTitle(normalizedTopicTitle, `${params.episodeDate}の判断ポイント`);
  }

  const firstJudgmentCardTitle = (params.judgmentCards ?? [])
    .sort((left, right) => left.topic_order - right.topic_order)
    .map((card) => formatTopicTitle(card.topic_title, ""))
    .find((title) => title.length > 0);

  if (firstJudgmentCardTitle) {
    return firstJudgmentCardTitle;
  }

  return `${params.episodeDate}の判断ポイント`;
};

export const resolveDisplayEpisodeTitle = (params: {
  title: string | null;
  judgmentCards?: Pick<JudgmentCard, "topic_order" | "topic_title">[];
  fallback?: string;
}): string => {
  if (!isGenericEpisodeTitle(params.title)) {
    return formatEpisodeTitle(params.title, params.fallback ?? "詳細未設定");
  }

  const firstJudgmentCardTitle = (params.judgmentCards ?? [])
    .toSorted((left, right) => left.topic_order - right.topic_order)
    .map((card) => formatTopicTitle(card.topic_title, ""))
    .find((title) => title.length > 0);

  if (firstJudgmentCardTitle) {
    return firstJudgmentCardTitle;
  }

  return formatEpisodeTitle(params.title, params.fallback ?? "詳細未設定");
};
