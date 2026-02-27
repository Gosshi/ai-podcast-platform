import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { resolveLocale } from "@/src/lib/i18n/locale";
import {
  isGenreAllowed,
  normalizeGenre,
  resolveAllowedGenres
} from "@/src/lib/genre/allowedGenres";
import EpisodesView from "./EpisodesView";
import type { EpisodeRow, JobRunRow, ViewLang } from "./types";

export const dynamic = "force-dynamic";

type SearchParams = {
  lang?: string | string[];
  filter?: string | string[];
  genre?: string | string[];
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

const loadEpisodesWithFailedRuns = async (genreFilter: string | null): Promise<{
  episodes: EpisodeRow[];
  failedRuns: JobRunRow[];
  error: string | null;
}> => {
  try {
    const supabase = createServiceRoleClient();
    let episodeQuery = supabase
      .from("episodes")
      .select(
        "id, master_id, lang, genre, status, title, script, script_polished, script_polished_preview, audio_url, published_at, created_at"
      )
      .in("lang", ["ja", "en"])
      .order("created_at", { ascending: false })
      .limit(150);

    if (genreFilter) {
      episodeQuery = episodeQuery.eq("genre", genreFilter);
    }

    const { data: episodeRows, error: episodeError } = await episodeQuery;

    if (episodeError) {
      return { episodes: [], failedRuns: [], error: episodeError.message };
    }

    const { data: failedRunRows, error: failedRunError } = await supabase
      .from("job_runs")
      .select("id, job_type, status, payload, error, started_at")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(200);

    if (failedRunError) {
      return {
        episodes: (episodeRows as EpisodeRow[]) ?? [],
        failedRuns: [],
        error: `failed to load job runs: ${failedRunError.message}`
      };
    }

    return {
      episodes: (episodeRows as EpisodeRow[]) ?? [],
      failedRuns: (failedRunRows as JobRunRow[]) ?? [],
      error: null
    };
  } catch (error) {
    return {
      episodes: [],
      failedRuns: [],
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
  const { episodes, failedRuns, error } = await loadEpisodesWithFailedRuns(genreFilter);

  return (
    <EpisodesView
      episodes={episodes}
      failedRuns={failedRuns}
      initialLocale={locale}
      initialViewLang={initialViewLang}
      loadError={error}
    />
  );
}
