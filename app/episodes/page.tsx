import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { resolveLocale } from "@/src/lib/i18n/locale";
import EpisodesView from "./EpisodesView";
import type { EpisodeRow, JobRunRow, ViewLang } from "./types";

export const dynamic = "force-dynamic";

type SearchParams = {
  lang?: string | string[];
  filter?: string | string[];
};

const readFirstParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const resolveViewLang = (value: string | undefined): ViewLang => {
  if (value === "ja" || value === "en") return value;
  return "all";
};

const loadEpisodesWithFailedRuns = async (): Promise<{
  episodes: EpisodeRow[];
  failedRuns: JobRunRow[];
  error: string | null;
}> => {
  try {
    const supabase = createServiceRoleClient();

    const { data: episodeRows, error: episodeError } = await supabase
      .from("episodes")
      .select("id, master_id, lang, status, title, script, audio_url, published_at, created_at")
      .in("lang", ["ja", "en"])
      .order("created_at", { ascending: false })
      .limit(150);

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
  const { episodes, failedRuns, error } = await loadEpisodesWithFailedRuns();

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
