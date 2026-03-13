type JudgmentType = "use_now" | "watch" | "skip";

export type WeeklyDecisionDigestCardBase = {
  judgment_type: JudgmentType;
  deadline_at: string | null;
  created_at: string;
  episode_published_at?: string | null;
  genre?: string | null;
  frame_type?: string | null;
};

const DECISION_TYPE_PRIORITY: Record<JudgmentType, number> = {
  use_now: 0,
  watch: 1,
  skip: 2
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
};

const compareOrderValues = (left: number, right: number): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const resolveDeadlineRank = (value: string | null): number => {
  const timestamp = toTimestamp(value);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const resolveRecencyRank = (card: WeeklyDecisionDigestCardBase): number => {
  const publishedTimestamp = toTimestamp(card.episode_published_at);
  if (!Number.isNaN(publishedTimestamp)) {
    return publishedTimestamp;
  }

  const createdTimestamp = toTimestamp(card.created_at);
  return Number.isNaN(createdTimestamp) ? 0 : createdTimestamp;
};

const sortWeeklyDecisionDigestCards = <T extends WeeklyDecisionDigestCardBase>(cards: T[]): T[] =>
  [...cards].sort((left, right) => {
    const deadlineComparison = compareOrderValues(
      resolveDeadlineRank(left.deadline_at),
      resolveDeadlineRank(right.deadline_at)
    );
    if (deadlineComparison !== 0) {
      return deadlineComparison;
    }

    const recencyComparison = compareOrderValues(resolveRecencyRank(right), resolveRecencyRank(left));
    if (recencyComparison !== 0) {
      return recencyComparison;
    }

    return DECISION_TYPE_PRIORITY[left.judgment_type] - DECISION_TYPE_PRIORITY[right.judgment_type];
  });

const groupWeeklyDecisionDigestCards = <T extends { judgment_type: JudgmentType }>(cards: T[]) =>
  cards.reduce<Record<JudgmentType, T[]>>(
    (groups, card) => {
      groups[card.judgment_type].push(card);
      return groups;
    },
    {
      use_now: [],
      watch: [],
      skip: []
    }
  );

const sortBreakdown = (entries: [string, number][]): { key: string; count: number }[] =>
  entries
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([key, count]) => ({ key, count }));

export const buildWeeklyDecisionDigest = <T extends WeeklyDecisionDigestCardBase>(
  cards: T[],
  perGroupLimit: number | null
) => {
  const sortedCards = sortWeeklyDecisionDigestCards(cards);
  const groupedAll = groupWeeklyDecisionDigestCards(sortedCards);
  const groupedVisible =
    typeof perGroupLimit === "number"
      ? {
          use_now: groupedAll.use_now.slice(0, perGroupLimit),
          watch: groupedAll.watch.slice(0, perGroupLimit),
          skip: groupedAll.skip.slice(0, perGroupLimit)
        }
      : groupedAll;

  const genreCounts = new Map<string, number>();
  const frameTypeCounts = new Map<string, number>();

  for (const card of sortedCards) {
    if (card.genre) {
      genreCounts.set(card.genre, (genreCounts.get(card.genre) ?? 0) + 1);
    }

    if (card.frame_type) {
      frameTypeCounts.set(card.frame_type, (frameTypeCounts.get(card.frame_type) ?? 0) + 1);
    }
  }

  return {
    groupedAll,
    groupedVisible,
    counts: {
      use_now: groupedAll.use_now.length,
      watch: groupedAll.watch.length,
      skip: groupedAll.skip.length
    },
    genreBreakdown: sortBreakdown([...genreCounts.entries()]),
    frameTypeBreakdown: sortBreakdown([...frameTypeCounts.entries()]),
    previewLimited:
      groupedAll.use_now.length !== groupedVisible.use_now.length ||
      groupedAll.watch.length !== groupedVisible.watch.length ||
      groupedAll.skip.length !== groupedVisible.skip.length
  };
};
