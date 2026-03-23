type DescriptionCard = {
  topic_order?: number;
  topic_title?: string | null;
  judgment_summary?: string | null;
};

const GENERIC_DESCRIPTION_PATTERNS = [
  /^Japanese episode for\b/iu,
  /^English adaptation for\b/iu,
  /^Episode for\b/iu
];

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

export const isGenericEpisodeDescription = (
  value: string | null | undefined
): boolean => {
  if (!value) {
    return true;
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  return GENERIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalized));
};

const buildCardSummary = (cards: DescriptionCard[] | undefined): string | null => {
  const summaries = (cards ?? [])
    .toSorted((left, right) => (left.topic_order ?? 0) - (right.topic_order ?? 0))
    .flatMap((card) => {
      const summary = normalizeText(card.judgment_summary ?? "");
      if (summary) return [summary];

      const topicTitle = normalizeText(card.topic_title ?? "");
      return topicTitle ? [`${topicTitle}の判断ポイントを整理します。`] : [];
    })
    .slice(0, 2);

  if (summaries.length === 0) {
    return null;
  }

  return summaries.join(" ");
};

export const resolveEpisodeDescription = (params: {
  description: string | null | undefined;
  previewText?: string | null | undefined;
  judgmentCards?: DescriptionCard[];
  fallback?: string;
}): string => {
  const normalizedDescription = normalizeText(params.description ?? "");
  if (normalizedDescription && !isGenericEpisodeDescription(normalizedDescription)) {
    return normalizedDescription;
  }

  const normalizedPreview = normalizeText(params.previewText ?? "");
  if (normalizedPreview) {
    return normalizedPreview;
  }

  const cardSummary = buildCardSummary(params.judgmentCards);
  if (cardSummary) {
    return cardSummary;
  }

  const fallback = normalizeText(params.fallback ?? "");
  return fallback || "今日の判断ポイントを、聴くだけで整理する回です。";
};
