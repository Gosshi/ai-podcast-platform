import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { resolveLocale } from "@/src/lib/i18n/locale";
import {
  isGenreAllowed,
  normalizeGenre,
  resolveAllowedGenres
} from "@/src/lib/genre/allowedGenres";
import type { JudgmentCard } from "@/src/lib/judgmentCards";
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
  judgment_cards: JudgmentCard[] | null;
  audio_url: string | null;
  published_at: string | null;
  created_at: string;
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

const mapEpisodeRow = (episode: EpisodeQueryRow, isPaid: boolean): EpisodeRow => {
  const judgmentCards = Array.isArray(episode.judgment_cards) ? episode.judgment_cards : [];

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
    judgment_cards: isPaid ? judgmentCards : [],
    judgment_card_count: judgmentCards.length,
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
    let query = supabase
      .from("episodes")
      .select(
        "id, master_id, lang, genre, status, title, description, script, script_polished, script_polished_preview, judgment_cards, audio_url, published_at, created_at"
      )
      .eq("status", "published")
      .not("published_at", "is", null)
      .in("lang", ["ja", "en"])
      .order("published_at", { ascending: false })
      .limit(150);

    if (params.genreFilter) {
      query = query.eq("genre", params.genreFilter);
    }

    const { data, error } = await query;
    if (error) {
      return { episodes: [], error: error.message };
    }

    return {
      episodes: ((data as EpisodeQueryRow[] | null) ?? []).map((episode) =>
        mapEpisodeRow(episode, params.isPaid)
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
