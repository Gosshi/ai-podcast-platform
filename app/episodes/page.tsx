import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { resolveLocale } from "@/src/lib/i18n/locale";
import {
  isGenreAllowed,
  normalizeGenre,
  resolveAllowedGenres
} from "@/src/lib/genre/allowedGenres";
import type { JudgmentCard, JudgmentThresholdJson, JudgmentType } from "@/src/lib/judgmentCards";
import EpisodesView from "./EpisodesView";
import type { EpisodeRow, ViewLang } from "./types";

export const dynamic = "force-dynamic";

type SearchParams = {
  lang?: string | string[];
  filter?: string | string[];
  genre?: string | string[];
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

const readFirstParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const resolveViewLang = (value: string | undefined): ViewLang => {
  if (value === "ja" || value === "en") return value;
  return "all";
};

const resolveGenreFilter = (value: string | undefined): string | null => {
  if (!value) return null;
  const normalized = normalizeGenre(value);
  if (!normalized) return null;

  const allowedGenres = resolveAllowedGenres(process.env.ALLOWED_GENRES);
  return isGenreAllowed(normalized, allowedGenres) ? normalized : null;
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

const resolveFullScript = (episode: EpisodeQueryRow, isPaid: boolean): string | null => {
  if (!isPaid) return null;
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

const buildFreeJudgmentPreview = (cards: JudgmentCard[]): JudgmentCard[] => {
  const first = cards[0];
  if (!first) return [];

  return [
    {
      ...first,
      action_text: null,
      deadline_at: null,
      watch_points: []
    }
  ];
};

const mapEpisodeRow = (
  episode: EpisodeQueryRow,
  judgmentCards: JudgmentCard[],
  isPaid: boolean
): EpisodeRow => {
  const visibleJudgmentCards = isPaid ? judgmentCards : buildFreeJudgmentPreview(judgmentCards);

  return {
    id: episode.id,
    master_id: episode.master_id,
    lang: episode.lang,
    genre: episode.genre,
    status: episode.status,
    title: episode.title,
    description: episode.description,
    preview_text: buildPreviewText(episode),
    full_script: resolveFullScript(episode, isPaid),
    judgment_cards: visibleJudgmentCards,
    judgment_card_count: judgmentCards.length,
    judgment_cards_preview_limited: !isPaid && judgmentCards.length > 0,
    audio_url: episode.audio_url,
    published_at: episode.published_at,
    created_at: episode.created_at
  };
};

const loadEpisodes = async (params: {
  genreFilter: string | null;
  isPaid: boolean;
}): Promise<{ episodes: EpisodeRow[]; error: string | null }> => {
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

    const { data: episodeData, error: episodeError } = await episodesQuery;
    if (episodeError) {
      return { episodes: [], error: episodeError.message };
    }

    const episodes = (episodeData as EpisodeQueryRow[] | null) ?? [];
    const episodeIds = episodes.map((episode) => episode.id);
    let judgmentCardsByEpisode = new Map<string, JudgmentCard[]>();

    if (episodeIds.length > 0) {
      let judgmentCardsQuery = supabase
        .from("episode_judgment_cards")
        .select(
          "id, episode_id, lang, genre, topic_order, topic_title, frame_type, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json, confidence_score"
        )
        .in("episode_id", episodeIds)
        .order("topic_order", { ascending: true });

      if (params.genreFilter) {
        judgmentCardsQuery = judgmentCardsQuery.eq("genre", params.genreFilter);
      }

      const { data: judgmentData, error: judgmentError } = await judgmentCardsQuery;
      if (judgmentError) {
        return {
          episodes: episodes.map((episode) => mapEpisodeRow(episode, [], params.isPaid)),
          error: judgmentError.message
        };
      }

      const judgmentRows = ((judgmentData as EpisodeJudgmentCardRow[] | null) ?? []);
      judgmentCardsByEpisode = judgmentRows.reduce((map, card) => {
        const current = map.get(card.episode_id) ?? [];
        current.push(mapJudgmentCardRow(card));
        map.set(card.episode_id, current);
        return map;
      }, new Map<string, JudgmentCard[]>());
    }

    return {
      episodes: episodes.map((episode) =>
        mapEpisodeRow(episode, judgmentCardsByEpisode.get(episode.id) ?? [], params.isPaid)
      ),
      error: null
    };
  } catch (error) {
    return {
      episodes: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export default async function EpisodesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = resolveLocale(readFirstParam(params.lang));
  const initialViewLang = resolveViewLang(readFirstParam(params.filter));
  const genreFilter = resolveGenreFilter(readFirstParam(params.genre));
  const viewer = await getViewerFromCookies();
  const { episodes, error } = await loadEpisodes({
    genreFilter,
    isPaid: viewer?.isPaid ?? false
  });

  return (
    <EpisodesView
      episodes={episodes}
      initialLocale={locale}
      initialViewLang={initialViewLang}
      loadError={error}
      viewer={viewer}
    />
  );
}
