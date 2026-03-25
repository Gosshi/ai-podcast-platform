import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { normalizeGenre, resolveAllowedGenres } from "@/src/lib/genre/allowedGenres";
import { extractJudgmentCards } from "@/src/lib/judgmentCards";
import { buildPublicEpisodeUrl } from "@/src/lib/episodeLinks";
import { isPodcastCompatibleAudioUrl } from "@/src/lib/podcastFeed";

export type ManualJaEpisodeInput = {
  title: string;
  description: string;
  script: string;
  episodeDate: string;
  genre?: string;
  previewText?: string | null;
  publish?: boolean;
  existingEpisodeId?: string | null;
  ttsBaseUrl: string;
  ttsFormat?: "mp3" | "aac" | "opus" | "flac" | "wav" | "pcm";
};

export type ManualJaEpisodeResult = {
  episodeId: string;
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  publishedAt: string | null;
  audioUrl: string | null;
  durationSec: number | null;
  judgmentCardsCount: number;
  provider: string | null;
  permalink: string;
};

type EpisodeStatus = ManualJaEpisodeResult["status"];

type EpisodeRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: EpisodeStatus;
  published_at: string | null;
  audio_url: string | null;
  duration_sec: number | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const resolveTrimmedString = (value: unknown): string | null => {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const assertIsoDate = (value: string): void => {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`episodeDate must be YYYY-MM-DD: ${value}`);
  }
};

const ensureAllowedGenre = (value: string): string => {
  const normalized = normalizeGenre(value);
  const allowed = resolveAllowedGenres(process.env.ALLOWED_GENRES);

  if (!allowed.includes(normalized)) {
    throw new Error(`genre must be one of: ${allowed.join(", ")}`);
  }

  return normalized;
};

const resolvePreviewText = (params: {
  previewText?: string | null;
  description: string;
}): string => {
  const previewText = resolveTrimmedString(params.previewText);
  if (previewText) return previewText;

  return params.description.length <= 240
    ? params.description
    : `${params.description.slice(0, 237).trimEnd()}...`;
};

const sanitizeInput = (input: ManualJaEpisodeInput): Required<Omit<ManualJaEpisodeInput, "publish">> & {
  publish: boolean;
} => {
  const title = resolveTrimmedString(input.title);
  const description = resolveTrimmedString(input.description);
  const script = resolveTrimmedString(input.script);
  const episodeDate = resolveTrimmedString(input.episodeDate);
  const ttsBaseUrl = resolveTrimmedString(input.ttsBaseUrl);

  if (!title || !description || !script || !episodeDate || !ttsBaseUrl) {
    throw new Error("title, description, script, episodeDate, ttsBaseUrl are required");
  }

  assertIsoDate(episodeDate);

  return {
    title,
    description,
    script,
    episodeDate,
    genre: ensureAllowedGenre(resolveTrimmedString(input.genre) ?? "tech"),
    previewText: resolveTrimmedString(input.previewText),
    publish: input.publish ?? true,
    existingEpisodeId: resolveTrimmedString(input.existingEpisodeId),
    ttsBaseUrl: ttsBaseUrl.replace(/\/+$/, ""),
    ttsFormat: input.ttsFormat ?? "mp3"
  };
};

const findExistingEpisode = async (
  episode: Required<Omit<ManualJaEpisodeInput, "publish">> & { publish: boolean }
): Promise<EpisodeRow | null> => {
  const supabase = createServiceRoleClient();

  if (episode.existingEpisodeId) {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, title, description, status, published_at, audio_url, duration_sec")
      .eq("id", episode.existingEpisodeId)
      .eq("lang", "ja")
      .maybeSingle<EpisodeRow>();

    if (error) throw error;
    if (!data) {
      throw new Error(`existing episode not found: ${episode.existingEpisodeId}`);
    }
    return data ?? null;
  }

  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, description, status, published_at, audio_url, duration_sec")
    .eq("lang", "ja")
    .eq("title", episode.title)
    .eq("episode_date", episode.episodeDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<EpisodeRow>();

  if (error) throw error;
  return data ?? null;
};

const upsertEpisode = async (params: {
  episode: Required<Omit<ManualJaEpisodeInput, "publish">> & { publish: boolean };
  existing: EpisodeRow | null;
  previewText: string;
  extractedCards: ReturnType<typeof extractJudgmentCards>;
}): Promise<EpisodeRow> => {
  const supabase = createServiceRoleClient();
  const baseValues = {
    lang: "ja" as const,
    title: params.episode.title,
    description: params.episode.description,
    genre: params.episode.genre,
    episode_date: params.episode.episodeDate,
    script: params.episode.script,
    script_polished: params.episode.script,
    script_polished_preview: params.previewText,
    judgment_cards: params.extractedCards
  };

  if (!params.existing) {
    const { data, error } = await supabase
      .from("episodes")
      .insert({
        ...baseValues,
        status: "draft"
      })
      .select("id, title, description, status, published_at, audio_url, duration_sec")
      .single<EpisodeRow>();

    if (error || !data) {
      throw error ?? new Error("failed to insert episode");
    }

    return data;
  }

  const { data, error } = await supabase
    .from("episodes")
    .update({
      ...baseValues,
      status: params.episode.publish ? params.existing.status : "draft"
    })
    .eq("id", params.existing.id)
    .select("id, title, description, status, published_at, audio_url, duration_sec")
    .single<EpisodeRow>();

  if (error || !data) {
    throw error ?? new Error("failed to update episode");
  }

  return data;
};

const syncJudgmentCards = async (params: {
  episodeId: string;
  genre: string;
  cards: ReturnType<typeof extractJudgmentCards>;
}): Promise<void> => {
  const supabase = createServiceRoleClient();
  const rows = params.cards.map((card) => ({
    episode_id: params.episodeId,
    lang: "ja",
    genre: params.genre,
    topic_order: card.topic_order,
    topic_title: card.topic_title,
    frame_type: card.frame_type,
    judgment_type: card.judgment_type,
    judgment_summary: card.judgment_summary,
    action_text: card.action_text,
    deadline_at: card.deadline_at,
    threshold_json: card.threshold_json,
    watch_points_json: card.watch_points,
    confidence_score: card.confidence_score
  }));

  const { error: upsertError } = await supabase
    .from("episode_judgment_cards")
    .upsert(rows, { onConflict: "episode_id,topic_order" });

  if (upsertError) {
    throw upsertError;
  }

  const maxTopicOrder = Math.max(...params.cards.map((card) => card.topic_order), 0);
  const { error: cleanupError } = await supabase
    .from("episode_judgment_cards")
    .delete()
    .eq("episode_id", params.episodeId)
    .gt("topic_order", maxTopicOrder);

  if (cleanupError) {
    throw cleanupError;
  }
};

const synthesizeAudio = async (params: {
  episodeId: string;
  ttsBaseUrl: string;
  ttsFormat: NonNullable<ManualJaEpisodeInput["ttsFormat"]>;
}): Promise<{
  audioUrl: string;
  durationSec: number;
  provider: string | null;
}> => {
  const response = await fetch(`${params.ttsBaseUrl}/api/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(resolveTrimmedString(process.env.LOCAL_TTS_API_KEY)
        ? { "x-local-tts-api-key": process.env.LOCAL_TTS_API_KEY!.trim() }
        : {})
    },
    body: JSON.stringify({
      episodeId: params.episodeId,
      lang: "ja",
      format: params.ttsFormat
    }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    audioUrl?: string;
    durationSec?: number;
    provider?: string | null;
    message?: string;
    error?: string;
  };

  if (!response.ok || payload.ok !== true || !payload.audioUrl || typeof payload.durationSec !== "number") {
    throw new Error(payload.message ?? payload.error ?? `tts_request_failed:${response.status}`);
  }

  return {
    audioUrl: payload.audioUrl,
    durationSec: payload.durationSec,
    provider: payload.provider ?? null
  };
};

const finalizeEpisode = async (params: {
  episode: EpisodeRow;
  publish: boolean;
  episodeDate: string;
  genre: string;
  audioUrl: string;
  durationSec: number;
}): Promise<EpisodeRow> => {
  const supabase = createServiceRoleClient();
  const publishedAt = params.publish ? params.episode.published_at ?? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("episodes")
    .update({
      audio_url: params.audioUrl,
      duration_sec: params.durationSec,
      status: params.publish ? "published" : "ready",
      published_at: publishedAt,
      episode_date: params.episodeDate,
      genre: params.genre
    })
    .eq("id", params.episode.id)
    .select("id, title, description, status, published_at, audio_url, duration_sec")
    .single<EpisodeRow>();

  if (error || !data) {
    throw error ?? new Error("failed to finalize episode");
  }

  return data;
};

export const publishManualJaEpisode = async (
  input: ManualJaEpisodeInput
): Promise<ManualJaEpisodeResult> => {
  const episode = sanitizeInput(input);
  const previewText = resolvePreviewText({
    previewText: episode.previewText,
    description: episode.description
  });
  const extractedCards = extractJudgmentCards(episode.script);

  if (extractedCards.length === 0) {
    throw new Error("no judgment cards extracted from script; check DEEPDIVE format");
  }

  const existing = await findExistingEpisode(episode);
  const draftEpisode = await upsertEpisode({
    episode,
    existing,
    previewText,
    extractedCards
  });

  await syncJudgmentCards({
    episodeId: draftEpisode.id,
    genre: episode.genre,
    cards: extractedCards
  });

  const audio = await synthesizeAudio({
    episodeId: draftEpisode.id,
    ttsBaseUrl: episode.ttsBaseUrl,
    ttsFormat: episode.ttsFormat
  });

  if (!isPodcastCompatibleAudioUrl(audio.audioUrl)) {
    throw new Error(`audioUrl is not podcast-compatible: ${audio.audioUrl}`);
  }

  const finalized = await finalizeEpisode({
    episode: draftEpisode,
    publish: episode.publish,
    episodeDate: episode.episodeDate,
    genre: episode.genre,
    audioUrl: audio.audioUrl,
    durationSec: audio.durationSec
  });

  const publicSiteUrl =
    resolveTrimmedString(process.env.NEXT_PUBLIC_SITE_URL) ??
    resolveTrimmedString(process.env.APP_BASE_URL) ??
    episode.ttsBaseUrl;

  return {
    episodeId: finalized.id,
    status: finalized.status,
    publishedAt: finalized.published_at,
    audioUrl: finalized.audio_url,
    durationSec: finalized.duration_sec,
    judgmentCardsCount: extractedCards.length,
    provider: audio.provider,
    permalink: buildPublicEpisodeUrl(finalized.id, publicSiteUrl)
  };
};
