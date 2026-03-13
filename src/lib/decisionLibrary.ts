import type { JudgmentThresholdJson, JudgmentType } from "./judgmentCards";

export const DECISION_LIBRARY_SORTS = [
  "newest",
  "deadline_soon",
  "judgment_priority"
] as const;

export type DecisionLibrarySort = (typeof DECISION_LIBRARY_SORTS)[number];

export const DECISION_LIBRARY_URGENCIES = [
  "overdue",
  "due_soon",
  "no_deadline"
] as const;

export type DecisionLibraryUrgency = (typeof DECISION_LIBRARY_URGENCIES)[number];

export type DecisionLibraryCardRecord = {
  topic_title: string;
  judgment_summary: string;
  judgment_type: JudgmentType;
  frame_type: string | null;
  genre: string | null;
  deadline_at: string | null;
  created_at: string;
  episode_published_at?: string | null;
};

export type GateableDecisionLibraryCard = {
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson;
  watch_points: string[];
  urgency: DecisionLibraryUrgency;
};

export type DecisionLibraryFilters = {
  query: string;
  genre: string | null;
  frameType: string | null;
  judgmentType: JudgmentType | null;
  urgency: DecisionLibraryUrgency | null;
  sort: DecisionLibrarySort;
};

const JUDGMENT_PRIORITY: Record<JudgmentType, number> = {
  use_now: 0,
  watch: 1,
  skip: 2
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
};

const resolveRecencyTimestamp = (card: Pick<DecisionLibraryCardRecord, "created_at" | "episode_published_at">): number => {
  const publishedAt = toTimestamp(card.episode_published_at);
  if (!Number.isNaN(publishedAt)) {
    return publishedAt;
  }

  const createdAt = toTimestamp(card.created_at);
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

const compareNullableAscending = (left: number, right: number): number => {
  const leftIsNaN = Number.isNaN(left);
  const rightIsNaN = Number.isNaN(right);

  if (leftIsNaN && rightIsNaN) return 0;
  if (leftIsNaN) return 1;
  if (rightIsNaN) return -1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export const normalizeDecisionLibraryQuery = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
};

export const resolveDecisionLibraryUrgency = (
  deadlineAt: string | null,
  now = new Date()
): DecisionLibraryUrgency => {
  if (!deadlineAt) {
    return "no_deadline";
  }

  const deadlineTimestamp = toTimestamp(deadlineAt);
  if (Number.isNaN(deadlineTimestamp)) {
    return "no_deadline";
  }

  return deadlineTimestamp < now.getTime() ? "overdue" : "due_soon";
};

export const sortDecisionLibraryCards = <T extends DecisionLibraryCardRecord>(
  cards: T[],
  sort: DecisionLibrarySort,
  now = new Date()
): T[] => {
  return [...cards].sort((left, right) => {
    if (sort === "newest") {
      return resolveRecencyTimestamp(right) - resolveRecencyTimestamp(left);
    }

    if (sort === "deadline_soon") {
      const deadlineComparison = compareNullableAscending(
        toTimestamp(left.deadline_at),
        toTimestamp(right.deadline_at)
      );

      if (deadlineComparison !== 0) {
        return deadlineComparison;
      }

      return resolveRecencyTimestamp(right) - resolveRecencyTimestamp(left);
    }

    const priorityComparison = JUDGMENT_PRIORITY[left.judgment_type] - JUDGMENT_PRIORITY[right.judgment_type];
    if (priorityComparison !== 0) {
      return priorityComparison;
    }

    const urgencyComparison =
      resolveDecisionLibraryUrgency(left.deadline_at, now) === resolveDecisionLibraryUrgency(right.deadline_at, now)
        ? 0
        : resolveDecisionLibraryUrgency(left.deadline_at, now) === "overdue"
          ? -1
          : resolveDecisionLibraryUrgency(right.deadline_at, now) === "overdue"
            ? 1
            : 0;
    if (urgencyComparison !== 0) {
      return urgencyComparison;
    }

    const deadlineComparison = compareNullableAscending(
      toTimestamp(left.deadline_at),
      toTimestamp(right.deadline_at)
    );
    if (deadlineComparison !== 0) {
      return deadlineComparison;
    }

    return resolveRecencyTimestamp(right) - resolveRecencyTimestamp(left);
  });
};

const matchesQuery = (card: DecisionLibraryCardRecord, query: string): boolean => {
  if (!query) return true;

  const normalizedQuery = query.toLocaleLowerCase("ja-JP");
  const haystack = [card.topic_title, card.judgment_summary].join(" ").toLocaleLowerCase("ja-JP");
  return haystack.includes(normalizedQuery);
};

export const applyDecisionLibraryFilters = <T extends DecisionLibraryCardRecord>(
  cards: T[],
  filters: DecisionLibraryFilters,
  now = new Date()
): T[] => {
  const query = normalizeDecisionLibraryQuery(filters.query);

  return sortDecisionLibraryCards(
    cards.filter((card) => {
      if (!matchesQuery(card, query)) return false;
      if (filters.genre && card.genre !== filters.genre) return false;
      if (filters.frameType && card.frame_type !== filters.frameType) return false;
      if (filters.judgmentType && card.judgment_type !== filters.judgmentType) return false;
      if (filters.urgency && resolveDecisionLibraryUrgency(card.deadline_at, now) !== filters.urgency) return false;
      return true;
    }),
    filters.sort,
    now
  );
};

export const lockDecisionLibraryCardDetails = <T extends GateableDecisionLibraryCard>(card: T): T => {
  return {
    ...card,
    action_text: null,
    deadline_at: null,
    threshold_json: {},
    watch_points: []
  };
};
