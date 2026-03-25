import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeGenre, resolveAllowedGenres } from "../src/lib/genre/allowedGenres.ts";
import { extractJudgmentCards } from "../src/lib/judgmentCards.ts";
import { isPodcastCompatibleAudioUrl } from "../src/lib/podcastFeed.ts";

type ManualEpisodeConfig = {
  title: string;
  description: string;
  scriptFile: string;
  episodeDate: string;
  genre?: string;
  previewText?: string;
  publish?: boolean;
  ttsBaseUrl?: string;
  ttsFormat?: "mp3" | "aac" | "opus" | "flac" | "wav" | "pcm";
  existingEpisodeId?: string;
};

type EpisodeRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  published_at: string | null;
  audio_url: string | null;
  duration_sec: number | null;
};

const usage = `Usage:
  node --experimental-strip-types scripts/register-manual-ja-episode.mts <config.json> [--dry-run]

Example:
  node --experimental-strip-types scripts/register-manual-ja-episode.mts docs/manual-episode-config-2026-03-23-ai-tools.json
`;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positionalArgs = args.filter((arg) => arg !== "--dry-run");
const configArg = positionalArgs[0];

if (!configArg) {
  console.error(usage);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const resolveTrimmedString = (value: unknown): string | null => {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const assertIsoDate = (value: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

const resolvePreviewText = (config: ManualEpisodeConfig): string => {
  const previewText = resolveTrimmedString(config.previewText);
  if (previewText) return previewText;

  return config.description.length <= 240
    ? config.description
    : `${config.description.slice(0, 237).trimEnd()}...`;
};

const resolveTtsBaseUrl = (config: ManualEpisodeConfig): string => {
  const configured =
    resolveTrimmedString(config.ttsBaseUrl) ??
    resolveTrimmedString(process.env.APP_BASE_URL) ??
    resolveTrimmedString(process.env.NEXT_PUBLIC_SITE_URL) ??
    "http://localhost:3000";

  return configured.replace(/\/+$/, "");
};

const loadConfig = async (configPath: string): Promise<{
  config: ManualEpisodeConfig;
  absoluteConfigPath: string;
}> => {
  const absoluteConfigPath = path.resolve(configPath);
  const raw = await readFile(absoluteConfigPath, "utf8");
  const parsed = JSON.parse(raw) as ManualEpisodeConfig;

  const title = resolveTrimmedString(parsed.title);
  const description = resolveTrimmedString(parsed.description);
  const scriptFile = resolveTrimmedString(parsed.scriptFile);
  const episodeDate = resolveTrimmedString(parsed.episodeDate);

  if (!title || !description || !scriptFile || !episodeDate) {
    throw new Error("config must include title, description, scriptFile, episodeDate");
  }

  assertIsoDate(episodeDate);

  return {
    config: {
      ...parsed,
      title,
      description,
      scriptFile,
      episodeDate,
      genre: ensureAllowedGenre(resolveTrimmedString(parsed.genre) ?? "tech"),
      previewText: resolveTrimmedString(parsed.previewText) ?? undefined,
      publish: parsed.publish ?? true,
      ttsBaseUrl: resolveTrimmedString(parsed.ttsBaseUrl) ?? undefined,
      ttsFormat: parsed.ttsFormat ?? "mp3",
      existingEpisodeId: resolveTrimmedString(parsed.existingEpisodeId) ?? undefined
    },
    absoluteConfigPath
  };
};

const loadScript = async (absoluteConfigPath: string, scriptFile: string): Promise<{
  script: string;
  scriptPath: string;
}> => {
  const scriptPath = path.resolve(path.dirname(absoluteConfigPath), scriptFile);
  const script = (await readFile(scriptPath, "utf8")).trim();

  if (!script) {
    throw new Error(`script file is empty: ${scriptPath}`);
  }

  return { script, scriptPath };
};

const findExistingEpisode = async (config: ManualEpisodeConfig): Promise<EpisodeRow | null> => {
  if (config.existingEpisodeId) {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, title, description, status, published_at, audio_url, duration_sec")
      .eq("id", config.existingEpisodeId)
      .eq("lang", "ja")
      .maybeSingle<EpisodeRow>();

    if (error) throw error;
    return data ?? null;
  }

  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, description, status, published_at, audio_url, duration_sec")
    .eq("lang", "ja")
    .eq("title", config.title)
    .eq("episode_date", config.episodeDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<EpisodeRow>();

  if (error) throw error;
  return data ?? null;
};

const upsertEpisode = async (params: {
  config: ManualEpisodeConfig;
  script: string;
  previewText: string;
  existing: EpisodeRow | null;
  extractedCards: ReturnType<typeof extractJudgmentCards>;
}): Promise<EpisodeRow> => {
  const baseValues = {
    lang: "ja" as const,
    title: params.config.title,
    description: params.config.description,
    genre: params.config.genre ?? "tech",
    episode_date: params.config.episodeDate,
    script: params.script,
    script_polished: params.script,
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
      status: params.config.publish ? params.existing.status : "draft"
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
  ttsFormat: NonNullable<ManualEpisodeConfig["ttsFormat"]>;
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
    })
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
  config: ManualEpisodeConfig;
  audioUrl: string;
  durationSec: number;
}): Promise<EpisodeRow> => {
  const shouldPublish = params.config.publish ?? true;
  const publishedAt = shouldPublish
    ? params.episode.published_at ?? new Date().toISOString()
    : null;

  const { data, error } = await supabase
    .from("episodes")
    .update({
      audio_url: params.audioUrl,
      duration_sec: params.durationSec,
      status: shouldPublish ? "published" : "ready",
      published_at: publishedAt,
      episode_date: params.config.episodeDate,
      genre: params.config.genre ?? "tech"
    })
    .eq("id", params.episode.id)
    .select("id, title, description, status, published_at, audio_url, duration_sec")
    .single<EpisodeRow>();

  if (error || !data) {
    throw error ?? new Error("failed to finalize episode");
  }

  return data;
};

const main = async (): Promise<void> => {
  const { config, absoluteConfigPath } = await loadConfig(configArg);
  const { script, scriptPath } = await loadScript(absoluteConfigPath, config.scriptFile);
  const previewText = resolvePreviewText(config);
  const extractedCards = extractJudgmentCards(script);

  if (extractedCards.length === 0) {
    throw new Error("no judgment cards extracted from script; check DEEPDIVE format");
  }

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      configPath: absoluteConfigPath,
      scriptPath,
      title: config.title,
      episodeDate: config.episodeDate,
      genre: config.genre,
      publish: config.publish ?? true,
      ttsBaseUrl: resolveTtsBaseUrl(config),
      judgmentCards: extractedCards.map((card) => ({
        topicOrder: card.topic_order,
        topicTitle: card.topic_title,
        judgmentType: card.judgment_type
      }))
    }, null, 2));
    return;
  }

  const existing = await findExistingEpisode(config);
  const episode = await upsertEpisode({
    config,
    script,
    previewText,
    existing,
    extractedCards
  });

  await syncJudgmentCards({
    episodeId: episode.id,
    genre: config.genre ?? "tech",
    cards: extractedCards
  });

  const audio = await synthesizeAudio({
    episodeId: episode.id,
    ttsBaseUrl: resolveTtsBaseUrl(config),
    ttsFormat: config.ttsFormat ?? "mp3"
  });

  if (!isPodcastCompatibleAudioUrl(audio.audioUrl)) {
    throw new Error(`audioUrl is not podcast-compatible: ${audio.audioUrl}`);
  }

  const finalized = await finalizeEpisode({
    episode,
    config,
    audioUrl: audio.audioUrl,
    durationSec: audio.durationSec
  });

  const siteUrl =
    resolveTrimmedString(process.env.NEXT_PUBLIC_SITE_URL) ??
    resolveTrimmedString(process.env.APP_BASE_URL);
  const permalink = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/episodes/${finalized.id}` : null;

  console.log(JSON.stringify({
    ok: true,
    episodeId: finalized.id,
    title: config.title,
    status: finalized.status,
    publishedAt: finalized.published_at,
    audioUrl: finalized.audio_url,
    durationSec: finalized.duration_sec,
    judgmentCardsCount: extractedCards.length,
    provider: audio.provider,
    permalink,
    configPath: absoluteConfigPath,
    scriptPath
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
