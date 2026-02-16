import { supabaseAdmin } from "./supabaseAdmin.ts";

export type EpisodeRecord = {
  id: string;
  master_id: string | null;
  lang: "ja" | "en";
  status: "queued" | "draft" | "generating" | "ready" | "failed";
  title: string | null;
  script: string | null;
  audio_url: string | null;
  published_at: string | null;
};

export const buildTitles = (episodeDate: string) => {
  return {
    ja: `Staging ${episodeDate} (JA)`,
    en: `Staging ${episodeDate} (EN)`
  };
};

export const fetchEpisodePair = async (episodeDate: string) => {
  const titles = buildTitles(episodeDate);

  const jaResult = await supabaseAdmin
    .from("episodes")
    .select("id, master_id, lang, status, title, script, audio_url, published_at")
    .eq("lang", "ja")
    .eq("title", titles.ja)
    .limit(1)
    .maybeSingle();

  if (jaResult.error) {
    throw jaResult.error;
  }

  if (!jaResult.data) {
    return { ja: null, en: null };
  }

  const enResult = await supabaseAdmin
    .from("episodes")
    .select("id, master_id, lang, status, title, script, audio_url, published_at")
    .eq("lang", "en")
    .eq("master_id", jaResult.data.id)
    .limit(1)
    .maybeSingle();

  if (enResult.error) {
    throw enResult.error;
  }

  return {
    ja: jaResult.data as EpisodeRecord,
    en: (enResult.data as EpisodeRecord | null) ?? null
  };
};

export const ensureEpisodePair = async (episodeDate: string) => {
  const titles = buildTitles(episodeDate);

  const existing = await fetchEpisodePair(episodeDate);
  let ja = existing.ja;
  let en = existing.en;

  if (!ja) {
    const insertJa = await supabaseAdmin
      .from("episodes")
      .insert({
        lang: "ja",
        title: titles.ja,
        status: "queued"
      })
      .select("id, master_id, lang, status, title, script, audio_url, published_at")
      .single();

    if (insertJa.error) {
      throw insertJa.error;
    }

    ja = insertJa.data as EpisodeRecord;
  }

  if (!en) {
    const insertEn = await supabaseAdmin
      .from("episodes")
      .insert({
        lang: "en",
        master_id: ja.id,
        title: titles.en,
        status: "queued"
      })
      .select("id, master_id, lang, status, title, script, audio_url, published_at")
      .single();

    if (insertEn.error) {
      throw insertEn.error;
    }

    en = insertEn.data as EpisodeRecord;
  }

  return { ja, en };
};

export const updateEpisode = async (
  id: string,
  values: Record<string, unknown>
): Promise<EpisodeRecord> => {
  const updateResult = await supabaseAdmin
    .from("episodes")
    .update(values)
    .eq("id", id)
    .select("id, master_id, lang, status, title, script, audio_url, published_at")
    .single();

  if (updateResult.error) {
    throw updateResult.error;
  }

  return updateResult.data as EpisodeRecord;
};
