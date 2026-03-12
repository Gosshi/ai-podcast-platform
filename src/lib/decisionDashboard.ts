import type { JudgmentType } from "./judgmentCards";

export type DecisionDashboardCardBase = {
  judgment_type: JudgmentType;
  deadline_at: string | null;
  created_at: string;
  episode_published_at?: string | null;
};

export type DecisionDashboardGroups<T> = Record<JudgmentType, T[]>;

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

const resolveDeadlineRank = (value: string | null): number => {
  const timestamp = toTimestamp(value);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const compareOrderValues = (left: number, right: number): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const resolveRecencyRank = (card: DecisionDashboardCardBase): number => {
  const publishedTimestamp = toTimestamp(card.episode_published_at);
  if (!Number.isNaN(publishedTimestamp)) {
    return publishedTimestamp;
  }

  const createdTimestamp = toTimestamp(card.created_at);
  return Number.isNaN(createdTimestamp) ? 0 : createdTimestamp;
};

const resolveDecisionDayKey = (card: DecisionDashboardCardBase, timeZone: string): string => {
  const sourceValue = card.episode_published_at ?? card.created_at;
  const date = new Date(sourceValue);

  if (Number.isNaN(date.getTime())) {
    return sourceValue.slice(0, 10);
  }

  return date.toLocaleDateString("en-CA", {
    timeZone
  });
};

export const sortDecisionDashboardCards = <T extends DecisionDashboardCardBase>(cards: T[]): T[] => {
  return [...cards].sort((left, right) => {
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
};

export const groupDecisionDashboardCards = <T extends { judgment_type: JudgmentType }>(
  cards: T[]
): DecisionDashboardGroups<T> => {
  return cards.reduce<DecisionDashboardGroups<T>>(
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
};

export const pickTodayDecisionCards = <T extends DecisionDashboardCardBase>(
  cards: T[],
  timeZone = "Asia/Tokyo"
): T[] => {
  const sortedCards = sortDecisionDashboardCards(cards);
  const firstCard = sortedCards[0];

  if (!firstCard) {
    return [];
  }

  const decisionDayKey = resolveDecisionDayKey(firstCard, timeZone);
  return sortedCards.filter((card) => resolveDecisionDayKey(card, timeZone) === decisionDayKey);
};
