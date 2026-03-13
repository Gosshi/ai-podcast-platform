import type {
  DecisionLibrarySort,
  DecisionLibraryUrgency
} from "@/src/lib/decisionLibrary";
import {
  lockDecisionLibraryCardDetails,
  normalizeDecisionLibraryQuery,
  resolveDecisionLibraryUrgency
} from "@/src/lib/decisionLibrary";
import type { JudgmentThresholdJson, JudgmentType } from "@/src/lib/judgmentCards";
import { FREE_ACCESS_WINDOW_DAYS } from "./contentAccess";
import { createServiceRoleClient } from "./supabaseClients";

export const FREE_LIBRARY_CARD_LIMIT = 12;
export const PAID_LIBRARY_PAGE_SIZE = 24;
export const DEFAULT_DECISION_LIBRARY_SORT: DecisionLibrarySort = "newest";

type JoinedEpisodeRow = {
  id: string;
  title: string | null;
  genre: string | null;
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  published_at: string | null;
};

type DecisionLibraryQueryRow = {
  id: string;
  episode_id: string;
  genre: string | null;
  topic_title: string;
  frame_type: string | null;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson | null;
  watch_points_json: string[] | null;
  created_at: string;
  episodes: JoinedEpisodeRow | JoinedEpisodeRow[] | null;
};

type DecisionLibraryFacetRow = {
  genre: string | null;
  frame_type: string | null;
  episodes: Pick<JoinedEpisodeRow, "genre"> | Array<Pick<JoinedEpisodeRow, "genre">> | null;
};

export type DecisionLibraryParams = {
  isPaid: boolean;
  query: string;
  genre: string | null;
  frameType: string | null;
  judgmentType: JudgmentType | null;
  urgency: DecisionLibraryUrgency | null;
  sort: DecisionLibrarySort;
  page: number;
};

export type DecisionLibraryCard = {
  id: string;
  episode_id: string;
  episode_title: string | null;
  episode_published_at: string | null;
  topic_title: string;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson;
  watch_points: string[];
  frame_type: string | null;
  genre: string | null;
  created_at: string;
  urgency: DecisionLibraryUrgency;
};

export type DecisionLibraryResult = {
  cards: DecisionLibraryCard[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  previewLimited: boolean;
  searchPreviewLimited: boolean;
  options: {
    genres: string[];
    frameTypes: string[];
  };
  error: string | null;
};

const resolveJoinedEpisode = (
  value: JoinedEpisodeRow | JoinedEpisodeRow[] | null
): JoinedEpisodeRow | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const resolveFacetEpisode = (
  value: Pick<JoinedEpisodeRow, "genre"> | Array<Pick<JoinedEpisodeRow, "genre">> | null
): Pick<JoinedEpisodeRow, "genre"> | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const buildFreeWindowStart = (now = new Date()): string => {
  return new Date(now.getTime() - FREE_ACCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
};

const sanitizeSearchToken = (value: string): string => {
  return value.replace(/[%_,()]/g, " ").trim().replace(/\s+/g, " ");
};

const applyLibraryQueryFilters = <
  T extends {
    eq: (...args: [string, string | number | boolean | null]) => T;
    gte: (...args: [string, string | number | boolean]) => T;
    lt: (...args: [string, string | number | boolean]) => T;
    not: (...args: [string, string, string | null]) => T;
    is: (...args: [string, null]) => T;
    or: (...args: [string]) => T;
  }
>(
  query: T,
  params: Pick<DecisionLibraryParams, "query" | "genre" | "frameType" | "judgmentType" | "urgency" | "isPaid">,
  now = new Date()
): T => {
  let nextQuery = query;

  if (!params.isPaid) {
    nextQuery = nextQuery.gte("episodes.published_at", buildFreeWindowStart(now));
  }

  if (params.genre) {
    nextQuery = nextQuery.eq("genre", params.genre);
  }

  if (params.frameType) {
    nextQuery = nextQuery.eq("frame_type", params.frameType);
  }

  if (params.judgmentType) {
    nextQuery = nextQuery.eq("judgment_type", params.judgmentType);
  }

  if (params.urgency === "no_deadline") {
    nextQuery = nextQuery.is("deadline_at", null);
  }

  if (params.urgency === "overdue") {
    nextQuery = nextQuery.lt("deadline_at", now.toISOString());
  }

  if (params.urgency === "due_soon") {
    nextQuery = nextQuery.gte("deadline_at", now.toISOString());
    nextQuery = nextQuery.not("deadline_at", "is", null);
  }

  const searchToken = sanitizeSearchToken(normalizeDecisionLibraryQuery(params.query));
  if (searchToken) {
    nextQuery = nextQuery.or(
      `topic_title.ilike.%${searchToken}%,judgment_summary.ilike.%${searchToken}%`
    );
  }

  return nextQuery;
};

const applyLibrarySort = <
  T extends {
    order: (...args: [string, { ascending: boolean; nullsFirst?: boolean }]) => T;
  }
>(
  query: T,
  sort: DecisionLibrarySort
): T => {
  if (sort === "deadline_soon") {
    return query
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  if (sort === "judgment_priority") {
    return query
      .order("judgment_priority", { ascending: true })
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  return query.order("created_at", { ascending: false });
};

const mapDecisionLibraryCard = (row: DecisionLibraryQueryRow): DecisionLibraryCard | null => {
  const episode = resolveJoinedEpisode(row.episodes);
  if (!episode) return null;

  return {
    id: row.id,
    episode_id: row.episode_id,
    episode_title: episode.title,
    episode_published_at: episode.published_at,
    topic_title: row.topic_title,
    judgment_type: row.judgment_type,
    judgment_summary: row.judgment_summary,
    action_text: row.action_text,
    deadline_at: row.deadline_at,
    threshold_json: row.threshold_json ?? {},
    watch_points: Array.isArray(row.watch_points_json) ? row.watch_points_json : [],
    frame_type: row.frame_type,
    genre: row.genre ?? episode.genre,
    created_at: row.created_at,
    urgency: resolveDecisionLibraryUrgency(row.deadline_at)
  };
};

export const prepareDecisionLibraryCardsForPlan = (
  cards: DecisionLibraryCard[],
  isPaid: boolean
): DecisionLibraryCard[] => {
  if (isPaid) {
    return cards;
  }

  return cards.map((card) => {
    const lockedCard = lockDecisionLibraryCardDetails(card);

    return {
      ...lockedCard,
      urgency: card.urgency
    };
  });
};

const loadDecisionLibraryFacetOptions = async (
  isPaid: boolean,
  now = new Date()
): Promise<{ genres: string[]; frameTypes: string[] }> => {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("episode_judgment_cards")
    .select("genre, frame_type, episodes!inner(genre, status, published_at)")
    .eq("episodes.status", "published")
    .not("episodes.published_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(240);

  if (!isPaid) {
    query = query.gte("episodes.published_at", buildFreeWindowStart(now));
  }

  const { data } = await query;
  const rows = (data as DecisionLibraryFacetRow[] | null) ?? [];

  const genres = new Set<string>();
  const frameTypes = new Set<string>();

  for (const row of rows) {
    const episode = resolveFacetEpisode(row.episodes);
    const genre = row.genre ?? episode?.genre ?? null;

    if (genre) {
      genres.add(genre);
    }

    if (row.frame_type) {
      frameTypes.add(row.frame_type);
    }
  }

  return {
    genres: [...genres].sort((left, right) => left.localeCompare(right, "ja-JP")),
    frameTypes: [...frameTypes].sort((left, right) => left.localeCompare(right, "ja-JP"))
  };
};

export const loadDecisionLibrary = async (
  params: DecisionLibraryParams
): Promise<DecisionLibraryResult> => {
  try {
    const supabase = createServiceRoleClient();
    const pageSize = params.isPaid ? PAID_LIBRARY_PAGE_SIZE : FREE_LIBRARY_CARD_LIMIT;
    const currentPage = params.isPaid ? Math.max(params.page, 1) : 1;
    const rangeStart = (currentPage - 1) * pageSize;
    const rangeEnd = rangeStart + pageSize - 1;
    let query = supabase
      .from("episode_judgment_cards")
      .select(
        "id, episode_id, genre, topic_title, frame_type, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json, created_at, episodes!inner(id, title, genre, status, published_at)",
        { count: "exact" }
      )
      .eq("episodes.status", "published")
      .not("episodes.published_at", "is", null);

    query = applyLibraryQueryFilters(query, params);
    query = applyLibrarySort(query, params.sort).range(rangeStart, rangeEnd);

    const [{ data, count, error }, options] = await Promise.all([
      query,
      loadDecisionLibraryFacetOptions(params.isPaid)
    ]);

    if (error) {
      return {
        cards: [],
        totalCount: 0,
        currentPage,
        totalPages: 1,
        previewLimited: false,
        searchPreviewLimited: false,
        options,
        error: error.message
      };
    }

    const mappedCards = ((data as DecisionLibraryQueryRow[] | null) ?? [])
      .map(mapDecisionLibraryCard)
      .filter((card): card is DecisionLibraryCard => Boolean(card));
    const visibleCards = prepareDecisionLibraryCardsForPlan(mappedCards, params.isPaid);
    const totalCount = count ?? visibleCards.length;
    const totalPages = params.isPaid ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

    return {
      cards: visibleCards,
      totalCount,
      currentPage,
      totalPages,
      previewLimited: !params.isPaid && totalCount > visibleCards.length,
      searchPreviewLimited: !params.isPaid && normalizeDecisionLibraryQuery(params.query).length > 0 && totalCount > visibleCards.length,
      options,
      error: null
    };
  } catch (error) {
    return {
      cards: [],
      totalCount: 0,
      currentPage: params.isPaid ? Math.max(params.page, 1) : 1,
      totalPages: 1,
      previewLimited: false,
      searchPreviewLimited: false,
      options: {
        genres: [],
        frameTypes: []
      },
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};
