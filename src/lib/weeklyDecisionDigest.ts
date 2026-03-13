import type { JudgmentType } from "./judgmentCards.ts";
import { groupDecisionDashboardCards, sortDecisionDashboardCards } from "./decisionDashboard.ts";

export type WeeklyDecisionDigestCardBase = {
  judgment_type: JudgmentType;
  deadline_at: string | null;
  created_at: string;
  episode_published_at?: string | null;
  genre?: string | null;
  frame_type?: string | null;
};

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
  const sortedCards = sortDecisionDashboardCards(cards);
  const groupedAll = groupDecisionDashboardCards(sortedCards);
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
