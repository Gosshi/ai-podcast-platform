import { supabaseAdmin } from "./supabaseAdmin.ts";
import { toJstDateStringFromIso } from "./dailyGenerateInterval.ts";

export type Episode = {
  id: string;
  master_id: string | null;
  lang: "ja" | "en";
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  title: string | null;
  description: string | null;
  script: string | null;
  script_polished: string | null;
  script_polished_preview: string | null;
  script_score: number | null;
  script_score_detail: Record<string, unknown> | null;
  audio_url: string | null;
  duration_sec: number | null;
  episode_date: string | null;
  published_at: string | null;
};

const EPISODE_SELECT_COLUMNS =
  "id, master_id, lang, status, title, description, script, script_polished, script_polished_preview, script_score, script_score_detail, audio_url, duration_sec, episode_date, published_at";

const normalizeScript = (value: string | null | undefined): string => {
  return typeof value === "string" ? value.trim() : "";
};

export const resolveEpisodeScriptForAudio = (
  episode: Pick<Episode, "script" | "script_polished">
): string => {
  const polished = normalizeScript(episode.script_polished);
  if (polished) {
    return polished;
  }

  return normalizeScript(episode.script);
};

const getJstDateRangeUtc = (episodeDate: string): { startIso: string; endIso: string } => {
  const parsed = new Date(`${episodeDate}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid episodeDate format; expected YYYY-MM-DD");
  }

  const start = parsed;
  const end = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

export const fetchEpisodeById = async (episodeId: string): Promise<Episode> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .select(EPISODE_SELECT_COLUMNS)
    .eq("id", episodeId)
    .single();

  if (error || !data) {
    throw error ?? new Error("episode not found");
  }

  return data as Episode;
};

export const updateEpisode = async (
  episodeId: string,
  values: Record<string, unknown>
): Promise<Episode> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .update(values)
    .eq("id", episodeId)
    .select(EPISODE_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error("failed to update episode");
  }

  return data as Episode;
};

export const findJapaneseEpisodeByTitle = async (title: string): Promise<Episode | null> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .select(EPISODE_SELECT_COLUMNS)
    .eq("lang", "ja")
    .eq("title", title)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Episode | null) ?? null;
};

export const findEnglishEpisodeByMasterId = async (
  masterId: string
): Promise<Episode | null> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .select(EPISODE_SELECT_COLUMNS)
    .eq("lang", "en")
    .eq("master_id", masterId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Episode | null) ?? null;
};

export const findPublishedEpisodeByJstDate = async (params: {
  episodeDate: string;
  lang: "ja" | "en";
  excludeEpisodeId?: string;
}): Promise<Episode | null> => {
  const { startIso, endIso } = getJstDateRangeUtc(params.episodeDate);

  let query = supabaseAdmin
    .from("episodes")
    .select(EPISODE_SELECT_COLUMNS)
    .eq("lang", params.lang)
    .eq("status", "published")
    .not("published_at", "is", null)
    .gte("published_at", startIso)
    .lt("published_at", endIso)
    .order("published_at", { ascending: false })
    .limit(1);

  if (params.excludeEpisodeId) {
    query = query.neq("id", params.excludeEpisodeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return (data as Episode | null) ?? null;
};

export const insertJapaneseEpisode = async (values: {
  title: string;
  description: string;
  script: string;
  episodeDate?: string;
}): Promise<Episode> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .insert({
      lang: "ja",
      status: "draft",
      title: values.title,
      description: values.description,
      script: values.script,
      episode_date: values.episodeDate ?? null
    })
    .select(EPISODE_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error("failed to insert ja episode");
  }

  return data as Episode;
};

export const insertEnglishEpisode = async (values: {
  masterId: string;
  title: string;
  description: string;
  script: string;
  episodeDate?: string;
}): Promise<Episode> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .insert({
      lang: "en",
      master_id: values.masterId,
      status: "draft",
      title: values.title,
      description: values.description,
      script: values.script,
      episode_date: values.episodeDate ?? null
    })
    .select(EPISODE_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error("failed to insert en episode");
  }

  return data as Episode;
};

export type LatestEpisodeDate = {
  date: string | null;
  source: "published_at" | "episode_date" | "none";
};

export const findLatestEpisodeDate = async (): Promise<LatestEpisodeDate> => {
  const { data: publishedRow, error: publishedError } = await supabaseAdmin
    .from("episodes")
    .select("published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (publishedError) {
    throw publishedError;
  }

  const latestPublishedAt =
    publishedRow && typeof publishedRow.published_at === "string" ? publishedRow.published_at : null;
  const latestPublishedDate = latestPublishedAt ? toJstDateStringFromIso(latestPublishedAt) : null;
  if (latestPublishedDate) {
    return {
      date: latestPublishedDate,
      source: "published_at"
    };
  }

  const { data: datedRow, error: datedError } = await supabaseAdmin
    .from("episodes")
    .select("episode_date")
    .not("episode_date", "is", null)
    .order("episode_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (datedError) {
    throw datedError;
  }

  const latestEpisodeDate =
    datedRow && typeof datedRow.episode_date === "string" ? datedRow.episode_date : null;
  if (latestEpisodeDate) {
    return {
      date: latestEpisodeDate,
      source: "episode_date"
    };
  }

  return {
    date: null,
    source: "none"
  };
};
