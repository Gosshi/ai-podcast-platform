/**
 * Episode loading and transformation utilities.
 *
 * Judgment cards are read from the `episode_judgment_cards` table (normalised,
 * source of truth). The `episodes.judgment_cards` JSONB column is a
 * denormalised cache maintained by Edge Functions and seed scripts for
 * backward-compat only — application code must NOT read from it.
 */
import type { JudgmentCard, JudgmentThresholdJson, JudgmentType } from "@/src/lib/judgmentCards";
import type { WatchlistCardState } from "@/src/lib/watchlist";
import { isWithinFreeAccessWindow } from "./contentAccess";
import { attachSavedDecisionState, type SavedJudgmentCard, loadSavedDecisions } from "./decisionHistory";
import { lockJudgmentDetails } from "./judgmentAccess";
import { createServiceRoleClient } from "./supabaseClients";
import { attachWatchlistState, loadWatchlistRecords } from "./watchlist";

export type EpisodeJudgmentCardState = SavedJudgmentCard & WatchlistCardState;

export type PublishedEpisodeRow = {
  id: string;
  master_id: string | null;
  lang: "ja" | "en";
  genre: string | null;
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  title: string | null;
  description: string | null;
  preview_text: string | null;
  full_script: string | null;
  judgment_cards: EpisodeJudgmentCardState[];
  judgment_card_count: number;
  judgment_cards_preview_limited: boolean;
  archive_locked: boolean;
  audio_url: string | null;
  published_at: string | null;
  created_at: string;
};

type EpisodeQueryRow = {
  id: string;
  master_id: string | null;
  lang: "ja" | "en";
  genre: string | null;
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  title: string | null;
  description: string | null;
  script: string | null;
  script_polished: string | null;
  script_polished_preview: string | null;
  audio_url: string | null;
  published_at: string | null;
  created_at: string;
};

type EpisodeJudgmentCardRow = {
  id: string;
  episode_id: string;
  lang: "ja" | "en";
  genre: string | null;
  topic_order: number;
  topic_title: string;
  frame_type: string | null;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson | null;
  watch_points_json: string[] | null;
  confidence_score: number | string | null;
};

const buildPreviewText = (episode: EpisodeQueryRow): string | null => {
  const preview = episode.script_polished_preview?.trim();
  if (preview) return preview;

  const description = episode.description?.trim();
  if (description) return description;

  const polished = episode.script_polished?.trim();
  if (polished) {
    return polished.slice(0, 240).trimEnd();
  }

  const script = episode.script?.trim();
  return script ? script.slice(0, 240).trimEnd() : null;
};

const resolveFreeAccessKey = (episode: EpisodeQueryRow): string => episode.published_at ?? episode.created_at;

const resolveFullScript = (
  episode: EpisodeQueryRow,
  isPaid: boolean,
  archiveLocked: boolean
): string | null => {
  if (!isPaid || archiveLocked) return null;

  const polished = episode.script_polished?.trim();
  if (polished) return polished;

  const script = episode.script?.trim();
  return script || null;
};

const mapJudgmentCardRow = (card: EpisodeJudgmentCardRow): JudgmentCard => {
  const confidenceValue =
    typeof card.confidence_score === "number"
      ? card.confidence_score
      : typeof card.confidence_score === "string"
        ? Number(card.confidence_score)
        : null;

  return {
    id: card.id,
    episode_id: card.episode_id,
    lang: card.lang,
    genre: card.genre,
    topic_order: card.topic_order,
    topic_title: card.topic_title,
    frame_type: card.frame_type,
    judgment_type: card.judgment_type,
    judgment_summary: card.judgment_summary,
    action_text: card.action_text,
    deadline_at: card.deadline_at,
    threshold_json: card.threshold_json ?? {},
    watch_points: Array.isArray(card.watch_points_json) ? card.watch_points_json : [],
    confidence_score:
      typeof confidenceValue === "number" && Number.isFinite(confidenceValue) ? confidenceValue : null
  };
};

const buildFreeJudgmentPreview = (cards: EpisodeJudgmentCardState[]): EpisodeJudgmentCardState[] => {
  return cards.map((card) => lockJudgmentDetails(card));
};

const mapEpisodeRow = (
  episode: EpisodeQueryRow,
  judgmentCards: EpisodeJudgmentCardState[],
  isPaid: boolean,
  options?: {
    previewArchivedEpisodes?: boolean;
  }
): PublishedEpisodeRow => {
  const previewArchivedEpisodes = options?.previewArchivedEpisodes ?? false;
  const archiveLocked = !isPaid && !isWithinFreeAccessWindow(resolveFreeAccessKey(episode));
  const canShowPreview = !archiveLocked || previewArchivedEpisodes;
  const visibleJudgmentCards = !canShowPreview
    ? []
    : isPaid
      ? judgmentCards
      : buildFreeJudgmentPreview(judgmentCards);

  return {
    id: episode.id,
    master_id: episode.master_id,
    lang: episode.lang,
    genre: episode.genre,
    status: episode.status,
    title: episode.title,
    description: episode.description,
    preview_text: canShowPreview ? buildPreviewText(episode) : null,
    full_script: resolveFullScript(episode, isPaid, archiveLocked),
    judgment_cards: visibleJudgmentCards,
    judgment_card_count: judgmentCards.length,
    judgment_cards_preview_limited: !isPaid && canShowPreview && judgmentCards.length > 0,
    archive_locked: archiveLocked,
    audio_url: episode.audio_url,
    published_at: episode.published_at,
    created_at: episode.created_at
  };
};

const mapPublicEpisodeRow = (
  episode: EpisodeQueryRow,
  judgmentCards: EpisodeJudgmentCardState[],
  isPaid: boolean
): PublishedEpisodeRow => {
  return mapEpisodeRow(episode, judgmentCards, isPaid, {
    previewArchivedEpisodes: true
  });
};

const loadJudgmentCardsByEpisode = async (
  episodeIds: string[],
  genreFilter: string | null
): Promise<{ judgmentCardsByEpisode: Map<string, JudgmentCard[]>; error: string | null }> => {
  if (episodeIds.length === 0) {
    return {
      judgmentCardsByEpisode: new Map<string, JudgmentCard[]>(),
      error: null
    };
  }

  const supabase = createServiceRoleClient();
  let judgmentCardsQuery = supabase
    .from("episode_judgment_cards")
    .select(
      "id, episode_id, lang, genre, topic_order, topic_title, frame_type, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json, confidence_score"
    )
    .in("episode_id", episodeIds)
    .order("topic_order", { ascending: true });

  if (genreFilter) {
    judgmentCardsQuery = judgmentCardsQuery.eq("genre", genreFilter);
  }

  const { data, error } = await judgmentCardsQuery;
  if (error) {
    return {
      judgmentCardsByEpisode: new Map<string, JudgmentCard[]>(),
      error: error.message
    };
  }

  const judgmentRows = (data as EpisodeJudgmentCardRow[] | null) ?? [];
  const judgmentCardsByEpisode = judgmentRows.reduce((map, card) => {
    const cards = map.get(card.episode_id) ?? [];
    cards.push(mapJudgmentCardRow(card));
    map.set(card.episode_id, cards);
    return map;
  }, new Map<string, JudgmentCard[]>());

  return {
    judgmentCardsByEpisode,
    error: null
  };
};

export const loadPublishedEpisodes = async (params: {
  genreFilter: string | null;
  isPaid: boolean;
  userId?: string | null;
}): Promise<{ episodes: PublishedEpisodeRow[]; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    let episodesQuery = supabase
      .from("episodes")
      .select(
        "id, master_id, lang, genre, status, title, description, script, script_polished, script_polished_preview, audio_url, published_at, created_at"
      )
      .eq("status", "published")
      .not("published_at", "is", null)
      .in("lang", ["ja", "en"])
      .order("published_at", { ascending: false })
      .limit(150);

    if (params.genreFilter) {
      episodesQuery = episodesQuery.eq("genre", params.genreFilter);
    }

    const { data, error } = await episodesQuery;
    if (error) {
      return {
        episodes: [],
        error: error.message
      };
    }

    const episodes = (data as EpisodeQueryRow[] | null) ?? [];
    const { judgmentCardsByEpisode, error: judgmentError } = await loadJudgmentCardsByEpisode(
      episodes.map((episode) => episode.id),
      params.genreFilter
    );
    const allJudgmentCards = Array.from(judgmentCardsByEpisode.values()).flat();
    const { savedDecisions, error: savedDecisionsError } = params.userId
      ? await loadSavedDecisions(
          params.userId,
          allJudgmentCards.flatMap((card) => (card.id ? [card.id] : []))
        )
      : { savedDecisions: new Map(), error: null };
    const { watchlist, error: watchlistError } = params.userId
      ? await loadWatchlistRecords(
          params.userId,
          allJudgmentCards.flatMap((card) => (card.id ? [card.id] : []))
        )
      : { watchlist: new Map(), error: null };

    return {
      episodes: episodes.map((episode) =>
        mapEpisodeRow(
          episode,
          attachWatchlistState<SavedJudgmentCard>(
            attachSavedDecisionState(judgmentCardsByEpisode.get(episode.id) ?? [], savedDecisions),
            watchlist
          ),
          params.isPaid
        )
      ),
      error: judgmentError ?? savedDecisionsError ?? watchlistError
    };
  } catch (error) {
    return {
      episodes: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export const loadPublishedEpisodeById = async (params: {
  episodeId: string;
  isPaid: boolean;
  userId?: string | null;
}): Promise<{ episode: PublishedEpisodeRow | null; error: string | null }> => {
  return loadEpisodeById(params, false);
};

export const loadPublicEpisodeById = async (params: {
  episodeId: string;
  isPaid: boolean;
  userId?: string | null;
}): Promise<{ episode: PublishedEpisodeRow | null; error: string | null }> => {
  return loadEpisodeById(params, true);
};

const loadEpisodeById = async (
  params: {
    episodeId: string;
    isPaid: boolean;
    userId?: string | null;
  },
  previewArchivedEpisodes: boolean
): Promise<{ episode: PublishedEpisodeRow | null; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("episodes")
      .select(
        "id, master_id, lang, genre, status, title, description, script, script_polished, script_polished_preview, audio_url, published_at, created_at"
      )
      .eq("id", params.episodeId)
      .eq("status", "published")
      .not("published_at", "is", null)
      .maybeSingle();

    if (error) {
      return {
        episode: null,
        error: error.message
      };
    }

    const episode = (data as EpisodeQueryRow | null) ?? null;
    if (!episode) {
      return {
        episode: null,
        error: null
      };
    }

    const { judgmentCardsByEpisode, error: judgmentError } = await loadJudgmentCardsByEpisode(
      [episode.id],
      null
    );
    const judgmentCards = judgmentCardsByEpisode.get(episode.id) ?? [];
    const { savedDecisions, error: savedDecisionsError } = params.userId
      ? await loadSavedDecisions(
          params.userId,
          judgmentCards.flatMap((card) => (card.id ? [card.id] : []))
        )
      : { savedDecisions: new Map(), error: null };
    const { watchlist, error: watchlistError } = params.userId
      ? await loadWatchlistRecords(
          params.userId,
          judgmentCards.flatMap((card) => (card.id ? [card.id] : []))
        )
      : { watchlist: new Map(), error: null };

    return {
      episode: (previewArchivedEpisodes ? mapPublicEpisodeRow : mapEpisodeRow)(
        episode,
        attachWatchlistState<SavedJudgmentCard>(
          attachSavedDecisionState(judgmentCards, savedDecisions),
          watchlist
        ),
        params.isPaid
      ),
      error: judgmentError ?? savedDecisionsError ?? watchlistError
    };
  } catch (error) {
    return {
      episode: null,
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};
