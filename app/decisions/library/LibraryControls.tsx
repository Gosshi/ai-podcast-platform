"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { DecisionLibrarySort, DecisionLibraryUrgency } from "@/src/lib/decisionLibrary";
import { track } from "@/src/lib/analytics";
import type { JudgmentType } from "@/src/lib/judgmentCards";
import styles from "./library-controls.module.css";

type LibraryControlsProps = {
  initialFilters: {
    query: string;
    genre: string | null;
    frameType: string | null;
    judgmentType: JudgmentType | null;
    urgency: DecisionLibraryUrgency | null;
    sort: DecisionLibrarySort;
  };
  defaultSort: DecisionLibrarySort;
  options: {
    genres: string[];
    frameTypes: string[];
  };
  isPaid: boolean;
};

const JUDGMENT_TYPE_LABELS: Array<{ value: JudgmentType | null; label: string }> = [
  { value: null, label: "All" },
  { value: "use_now", label: "使う" },
  { value: "watch", label: "監視" },
  { value: "skip", label: "見送り" }
];

const URGENCY_LABELS: Array<{ value: DecisionLibraryUrgency | null; label: string }> = [
  { value: null, label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due Soon" },
  { value: "no_deadline", label: "No Deadline" }
];

const SORT_LABELS: Record<DecisionLibrarySort, string> = {
  newest: "Newest",
  deadline_soon: "Deadline Soon",
  judgment_priority: "Judgment Priority"
};

const buildSearchParams = (
  filters: LibraryControlsProps["initialFilters"],
  defaultSort: DecisionLibrarySort
): string => {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.frameType) params.set("frame", filters.frameType);
  if (filters.judgmentType) params.set("judgment", filters.judgmentType);
  if (filters.urgency) params.set("urgency", filters.urgency);
  if (filters.sort !== defaultSort) params.set("sort", filters.sort);

  return params.toString();
};

export default function LibraryControls({
  initialFilters,
  defaultSort,
  options,
  isPaid
}: LibraryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialFilters.query);
  const [genre, setGenre] = useState(initialFilters.genre);
  const [frameType, setFrameType] = useState(initialFilters.frameType);
  const [judgmentType, setJudgmentType] = useState<JudgmentType | null>(initialFilters.judgmentType);
  const [urgency, setUrgency] = useState<DecisionLibraryUrgency | null>(initialFilters.urgency);
  const [sort, setSort] = useState<DecisionLibrarySort>(initialFilters.sort);

  useEffect(() => {
    setQuery(initialFilters.query);
    setGenre(initialFilters.genre);
    setFrameType(initialFilters.frameType);
    setJudgmentType(initialFilters.judgmentType);
    setUrgency(initialFilters.urgency);
    setSort(initialFilters.sort);
  }, [initialFilters]);

  const navigate = (nextFilters: LibraryControlsProps["initialFilters"]) => {
    const searchParams = buildSearchParams(nextFilters, defaultSort);
    const url = searchParams ? `${pathname}?${searchParams}` : pathname;

    startTransition(() => {
      router.push(url);
    });
  };

  const buildAnalyticsProperties = (filters: LibraryControlsProps["initialFilters"]) => ({
    page: "/decisions/library",
    source: "library_controls",
    query: filters.query || undefined,
    genre: filters.genre ?? undefined,
    frame_type: filters.frameType ?? undefined,
    judgment_type: filters.judgmentType ?? undefined,
    urgency: filters.urgency ?? undefined,
    sort: filters.sort,
    is_paid: isPaid
  });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFilters = {
      query: query.trim(),
      genre,
      frameType,
      judgmentType,
      urgency,
      sort
    } satisfies LibraryControlsProps["initialFilters"];

    track("library_search", {
      ...buildAnalyticsProperties(nextFilters),
      query: nextFilters.query || undefined,
      query_length: nextFilters.query.length
    });
    navigate(nextFilters);
  };

  const applyFilterChange = <T extends keyof LibraryControlsProps["initialFilters"]>(
    filterName: T,
    value: LibraryControlsProps["initialFilters"][T]
  ) => {
    const nextFilters = {
      query: query.trim(),
      genre,
      frameType,
      judgmentType,
      urgency,
      sort,
      [filterName]: value
    } satisfies LibraryControlsProps["initialFilters"];

    track("library_filter_change", {
      ...buildAnalyticsProperties(nextFilters),
      filter_name: filterName,
      filter_value: typeof value === "string" ? value : value ?? "all"
    });
    navigate(nextFilters);
  };

  return (
    <section className={styles.panel}>
      <form className={styles.searchRow} onSubmit={submitSearch}>
        <label className={styles.searchLabel}>
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="topic title / judgment summary"
            className={styles.searchInput}
          />
        </label>
        <button type="submit" className={styles.primaryButton} disabled={isPending}>
          Search
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isPending}
          onClick={() => {
            setQuery("");
            setGenre(null);
            setFrameType(null);
            setJudgmentType(null);
            setUrgency(null);
            setSort(defaultSort);
            const resetFilters = {
              query: "",
              genre: null,
              frameType: null,
              judgmentType: null,
              urgency: null,
              sort: defaultSort
            };
            track("library_filter_change", {
              ...buildAnalyticsProperties(resetFilters),
              filter_name: "reset",
              filter_value: "all"
            });
            navigate(resetFilters);
          }}
        >
          Reset
        </button>
      </form>

      <div className={styles.controlGrid}>
        <label className={styles.selectLabel}>
          <span>Genre</span>
          <select
            value={genre ?? ""}
            onChange={(event) => {
              const nextValue = event.target.value || null;
              setGenre(nextValue);
              applyFilterChange("genre", nextValue);
            }}
            className={styles.select}
          >
            <option value="">All genres</option>
            {options.genres.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.selectLabel}>
          <span>Frame</span>
          <select
            value={frameType ?? ""}
            onChange={(event) => {
              const nextValue = event.target.value || null;
              setFrameType(nextValue);
              applyFilterChange("frameType", nextValue);
            }}
            className={styles.select}
          >
            <option value="">All frames</option>
            {options.frameTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.selectLabel}>
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => {
              const nextValue = event.target.value as DecisionLibrarySort;
              setSort(nextValue);
              const nextFilters = {
                query: query.trim(),
                genre,
                frameType,
                judgmentType,
                urgency,
                sort: nextValue
              } satisfies LibraryControlsProps["initialFilters"];
              track("library_sort_change", {
                ...buildAnalyticsProperties(nextFilters),
                previous_sort: sort,
                next_sort: nextValue
              });
              navigate(nextFilters);
            }}
            className={styles.select}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.chipGroup}>
        <span className={styles.chipLabel}>Judgment</span>
        <div className={styles.chipRow}>
          {JUDGMENT_TYPE_LABELS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`${styles.chip} ${judgmentType === item.value ? styles.chipActive : ""}`.trim()}
              onClick={() => {
                setJudgmentType(item.value);
                applyFilterChange("judgmentType", item.value);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chipGroup}>
        <span className={styles.chipLabel}>Urgency</span>
        <div className={styles.chipRow}>
          {URGENCY_LABELS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`${styles.chip} ${urgency === item.value ? styles.chipActive : ""}`.trim()}
              onClick={() => {
                setUrgency(item.value);
                applyFilterChange("urgency", item.value);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
