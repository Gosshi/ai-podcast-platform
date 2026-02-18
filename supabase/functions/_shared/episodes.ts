import { supabaseAdmin } from "./supabaseAdmin.ts";

export type Episode = {
  id: string;
  master_id: string | null;
  lang: "ja" | "en";
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  title: string | null;
  description: string | null;
  script: string | null;
  audio_url: string | null;
  duration_sec: number | null;
  published_at: string | null;
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
    .select(
      "id, master_id, lang, status, title, description, script, audio_url, duration_sec, published_at"
    )
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
    .select(
      "id, master_id, lang, status, title, description, script, audio_url, duration_sec, published_at"
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("failed to update episode");
  }

  return data as Episode;
};

export const findJapaneseEpisodeByTitle = async (title: string): Promise<Episode | null> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .select(
      "id, master_id, lang, status, title, description, script, audio_url, duration_sec, published_at"
    )
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
    .select(
      "id, master_id, lang, status, title, description, script, audio_url, duration_sec, published_at"
    )
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
    .select(
      "id, master_id, lang, status, title, description, script, audio_url, duration_sec, published_at"
    )
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
}): Promise<Episode> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .insert({
      lang: "ja",
      status: "draft",
      title: values.title,
      description: values.description,
      script: values.script
    })
    .select(
      "id, master_id, lang, status, title, description, script, audio_url, duration_sec, published_at"
    )
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
}): Promise<Episode> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .insert({
      lang: "en",
      master_id: values.masterId,
      status: "draft",
      title: values.title,
      description: values.description,
      script: values.script
    })
    .select(
      "id, master_id, lang, status, title, description, script, audio_url, duration_sec, published_at"
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("failed to insert en episode");
  }

  return data as Episode;
};
