import type { JudgmentType } from "./judgmentCards";

export const WATCHLIST_STATUSES = ["saved", "watching", "archived"] as const;
export type WatchlistStatus = (typeof WATCHLIST_STATUSES)[number];

export const WATCHLIST_SORTS = ["newest", "deadline_soon", "saved_order"] as const;
export type WatchlistSort = (typeof WATCHLIST_SORTS)[number];

export const WATCHLIST_URGENCIES = ["overdue", "due_soon", "no_deadline"] as const;
export type WatchlistUrgency = (typeof WATCHLIST_URGENCIES)[number];

export const FREE_WATCHLIST_LIMIT = 5;

export type WatchlistRecord = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  status: WatchlistStatus;
  created_at: string;
  updated_at: string;
};

export type WatchlistCardState = {
  is_in_watchlist: boolean;
  watchlist_item_id: string | null;
  watchlist_status: WatchlistStatus | null;
  watchlist_created_at: string | null;
  watchlist_updated_at: string | null;
};

export type WatchlistListRecord = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  status: WatchlistStatus;
  topic_title: string;
  judgment_type: JudgmentType;
  frame_type: string | null;
  genre: string | null;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
  episode_title?: string | null;
  episode_published_at?: string | null;
};

export type WatchlistFilters = {
  status: WatchlistStatus | null;
  genre: string | null;
  frameType: string | null;
  urgency: WatchlistUrgency | null;
  sort: WatchlistSort;
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
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

export const isWatchlistStatus = (value: unknown): value is WatchlistStatus => {
  return typeof value === "string" && WATCHLIST_STATUSES.includes(value as WatchlistStatus);
};

export const isWatchlistSort = (value: unknown): value is WatchlistSort => {
  return typeof value === "string" && WATCHLIST_SORTS.includes(value as WatchlistSort);
};

export const isWatchlistUrgency = (value: unknown): value is WatchlistUrgency => {
  return typeof value === "string" && WATCHLIST_URGENCIES.includes(value as WatchlistUrgency);
};

export const resolveWatchlistUrgency = (
  deadlineAt: string | null,
  now = new Date()
): WatchlistUrgency => {
  if (!deadlineAt) {
    return "no_deadline";
  }

  const deadlineTimestamp = toTimestamp(deadlineAt);
  if (Number.isNaN(deadlineTimestamp)) {
    return "no_deadline";
  }

  return deadlineTimestamp < now.getTime() ? "overdue" : "due_soon";
};

export const hasReachedWatchlistLimit = (count: number, isPaid: boolean): boolean => {
  return !isPaid && count >= FREE_WATCHLIST_LIMIT;
};

export const sortWatchlistItems = <T extends Pick<WatchlistListRecord, "deadline_at" | "created_at">>(
  items: T[],
  sort: WatchlistSort
): T[] => {
  return [...items].sort((left, right) => {
    if (sort === "saved_order") {
      return toTimestamp(left.created_at) - toTimestamp(right.created_at);
    }

    if (sort === "deadline_soon") {
      const deadlineComparison = compareNullableAscending(
        toTimestamp(left.deadline_at),
        toTimestamp(right.deadline_at)
      );

      if (deadlineComparison !== 0) {
        return deadlineComparison;
      }
    }

    return toTimestamp(right.created_at) - toTimestamp(left.created_at);
  });
};

export const applyWatchlistFilters = <T extends WatchlistListRecord>(
  items: T[],
  filters: WatchlistFilters,
  now = new Date()
): T[] => {
  return sortWatchlistItems(
    items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      if (filters.genre && item.genre !== filters.genre) return false;
      if (filters.frameType && item.frame_type !== filters.frameType) return false;
      if (filters.urgency && resolveWatchlistUrgency(item.deadline_at, now) !== filters.urgency) return false;
      return true;
    }),
    filters.sort
  );
};
