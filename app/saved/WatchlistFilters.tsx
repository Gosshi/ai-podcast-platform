"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { track } from "@/src/lib/analytics";
import { formatFrameTypeLabel, formatGenreLabel } from "@/app/lib/uiText";
import {
  type WatchlistSort,
  type WatchlistStatus,
  type WatchlistUrgency
} from "@/src/lib/watchlist";
import styles from "./page.module.css";

type WatchlistFiltersProps = {
  initialFilters: {
    status: WatchlistStatus | null;
    genre: string | null;
    frameType: string | null;
    urgency: WatchlistUrgency | null;
    sort: WatchlistSort;
  };
  options: {
    genres: string[];
    frameTypes: string[];
  };
  isPaid: boolean;
};

const STATUS_OPTIONS: Array<{ value: WatchlistStatus | null; label: string }> = [
  { value: null, label: "すべて" },
  { value: "saved", label: "後で考える" },
  { value: "archived", label: "見送る" }
];

const URGENCY_OPTIONS: Array<{ value: WatchlistUrgency | null; label: string }> = [
  { value: null, label: "すべて" },
  { value: "overdue", label: "期限切れ" },
  { value: "due_soon", label: "期限あり" },
  { value: "no_deadline", label: "期限なし" }
];

const SORT_LABELS: Record<WatchlistSort, string> = {
  newest: "新しい順",
  deadline_soon: "期限が近い順",
  saved_order: "保存順"
};

const buildSearchParams = (filters: WatchlistFiltersProps["initialFilters"], isPaid: boolean): string => {
  const params = new URLSearchParams();

  if (filters.status) params.set("status", filters.status);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.frameType) params.set("frame", filters.frameType);
  if (isPaid && filters.urgency) params.set("urgency", filters.urgency);
  if (filters.sort !== "newest") params.set("sort", filters.sort);

  return params.toString();
};

export default function WatchlistFilters({
  initialFilters,
  options,
  isPaid
}: WatchlistFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<WatchlistStatus | null>(initialFilters.status);
  const [genre, setGenre] = useState(initialFilters.genre);
  const [frameType, setFrameType] = useState(initialFilters.frameType);
  const [urgency, setUrgency] = useState<WatchlistUrgency | null>(initialFilters.urgency);
  const [sort, setSort] = useState<WatchlistSort>(initialFilters.sort);

  useEffect(() => {
    setStatus(initialFilters.status);
    setGenre(initialFilters.genre);
    setFrameType(initialFilters.frameType);
    setUrgency(initialFilters.urgency);
    setSort(initialFilters.sort);
  }, [initialFilters]);

  const navigate = (nextFilters: WatchlistFiltersProps["initialFilters"]) => {
    const searchParams = buildSearchParams(nextFilters, isPaid);
    const url = searchParams ? `${pathname}?${searchParams}` : pathname;

    startTransition(() => {
      router.push(url);
    });
  };

  const trackFilterChange = (
    filterName: string,
    filterValue: string,
    nextFilters: WatchlistFiltersProps["initialFilters"]
  ) => {
    track("watchlist_filter_change", {
      page: "/saved",
      source: "watchlist_filters",
      filter_name: filterName,
      filter_value: filterValue,
      status: nextFilters.status ?? undefined,
      genre: nextFilters.genre ?? undefined,
      frame_type: nextFilters.frameType ?? undefined,
      urgency: nextFilters.urgency ?? undefined,
      sort: nextFilters.sort,
      is_paid: isPaid
    });
  };

  const updateFilters = <T extends keyof WatchlistFiltersProps["initialFilters"]>(
    key: T,
    value: WatchlistFiltersProps["initialFilters"][T]
  ) => {
    const nextFilters = {
      status,
      genre,
      frameType,
      urgency,
      sort,
      [key]: value
    } satisfies WatchlistFiltersProps["initialFilters"];

    trackFilterChange(key, typeof value === "string" ? value : value ?? "all", nextFilters);
    navigate(nextFilters);
  };

  return (
    <section className={styles.filterPanel}>
      <div className={styles.filterGrid}>
        <label className={styles.selectLabel}>
          <span>状態</span>
          <select
            value={status ?? ""}
            className={styles.select}
            disabled={isPending}
            onChange={(event) => {
              const nextValue = (event.target.value || null) as WatchlistStatus | null;
              setStatus(nextValue);
              updateFilters("status", nextValue);
            }}
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.label} value={item.value ?? ""}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.selectLabel}>
          <span>ジャンル</span>
          <select
            value={genre ?? ""}
            className={styles.select}
            disabled={isPending}
            onChange={(event) => {
              const nextValue = event.target.value || null;
              setGenre(nextValue);
              updateFilters("genre", nextValue);
            }}
          >
            <option value="">すべてのジャンル</option>
            {options.genres.map((item) => (
              <option key={item} value={item}>
                {formatGenreLabel(item, item)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.selectLabel}>
          <span>判断の切り口</span>
          <select
            value={frameType ?? ""}
            className={styles.select}
            disabled={isPending}
            onChange={(event) => {
              const nextValue = event.target.value || null;
              setFrameType(nextValue);
              updateFilters("frameType", nextValue);
            }}
          >
            <option value="">すべての判断の切り口</option>
            {options.frameTypes.map((item) => (
              <option key={item} value={item}>
                {formatFrameTypeLabel(item, item)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.selectLabel}>
          <span>並び順</span>
          <select
            value={sort}
            className={styles.select}
            disabled={isPending}
            onChange={(event) => {
              const nextValue = event.target.value as WatchlistSort;
              setSort(nextValue);
              updateFilters("sort", nextValue);
            }}
          >
            {Object.entries(SORT_LABELS)
              .filter(([value]) => isPaid || value !== "deadline_soon")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>

        <label className={styles.selectLabel}>
          <span>見直しタイミング</span>
          <select
            value={urgency ?? ""}
            className={styles.select}
            disabled={!isPaid || isPending}
            onChange={(event) => {
              const nextValue = (event.target.value || null) as WatchlistUrgency | null;
              setUrgency(nextValue);
              updateFilters("urgency", nextValue);
            }}
          >
            {URGENCY_OPTIONS.map((item) => (
              <option key={item.label} value={item.value ?? ""}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.filterFooter}>
        {!isPaid ? <p className={styles.filterHint}>無料版では期限での絞り込みと並び替えは一部のみ使えます。</p> : null}
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isPending}
          onClick={() => {
            const resetFilters = {
              status: null,
              genre: null,
              frameType: null,
              urgency: null,
              sort: "newest" as const
            };
            setStatus(null);
            setGenre(null);
            setFrameType(null);
            setUrgency(null);
            setSort("newest");
            trackFilterChange("reset", "all", resetFilters);
            navigate(resetFilters);
          }}
        >
          リセット
        </button>
      </div>
    </section>
  );
}
