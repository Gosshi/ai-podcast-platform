import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { fetchEpisodeById, updateEpisode } from "../_shared/episodes.ts";
import {
  buildAudioVersion,
  hasVersionedAudioUrl,
  resolveConfiguredTtsProvider,
  resolveTtsSignatureConfig
} from "../_shared/audioVersion.ts";
import { synthesizeEpisodeAudio } from "../_shared/localTts.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  episodeId?: string;
};

const buildForcedAudioVersion = (baseVersion: string): string => {
  const revision = Date.now().toString(36);
  return `${baseVersion}${revision}`.slice(0, 64);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  if (!body.episodeId) {
    return jsonResponse({ ok: false, error: "episodeId is required" }, 400);
  }

  const runId = await startRun("tts-ja", {
    step: "tts-ja",
    episodeDate,
    idempotencyKey,
    episodeId: body.episodeId
  });

  try {
    const episode = await fetchEpisodeById(body.episodeId);
    const script = episode.script ?? episode.title ?? "";
    const ttsConfig = resolveTtsSignatureConfig("ja");
    const baseAudioVersion = await buildAudioVersion(script, ttsConfig);
    const forceLocalTts = Deno.env.get("LOCAL_TTS_ENABLED") === "1";
    const audioVersion = forceLocalTts ? buildForcedAudioVersion(baseAudioVersion) : baseAudioVersion;
    const hasCurrentVersionAudio = hasVersionedAudioUrl({
      episodeId: episode.id,
      lang: "ja",
      audioVersion: baseAudioVersion,
      audioUrl: episode.audio_url
    });

    if (!forceLocalTts && hasCurrentVersionAudio) {
      await finishRun(runId, {
        step: "tts-ja",
        episodeDate,
        idempotencyKey,
        episodeId: episode.id,
        noOp: true,
        reason: "audio_exists_for_version",
        audioVersion: baseAudioVersion,
        tts_provider: ttsConfig.provider,
        model: ttsConfig.model,
        voice: ttsConfig.voice,
        format: ttsConfig.format,
        speed: ttsConfig.speed
      });

      return jsonResponse({ ok: true, episodeId: episode.id, noOp: true });
    }

    await updateEpisode(episode.id, { status: "generating" });
    const synthesized = await synthesizeEpisodeAudio({
      episodeId: episode.id,
      lang: "ja",
      text: script,
      audioVersion
    });
    const audioUrl = synthesized.audioUrl;
    const updated = await updateEpisode(episode.id, {
      audio_url: audioUrl,
      duration_sec: synthesized.durationSec,
      status: "ready"
    });

    await finishRun(runId, {
      step: "tts-ja",
      episodeDate,
      idempotencyKey,
      episodeId: updated.id,
      noOp: false,
      audioVersion,
      audioUrl,
      tts_provider: synthesized.provider,
      requested_provider: synthesized.requestedProvider,
      model: synthesized.model,
      voice: synthesized.voice,
      format: synthesized.format,
      speed: ttsConfig.speed,
      fallback_reason: synthesized.fallbackReason
    });

    return jsonResponse({ ok: true, episodeId: updated.id, audioUrl, status: updated.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const ttsConfig = resolveTtsSignatureConfig("ja");
    await failRun(runId, message, {
      step: "tts-ja",
      episodeDate,
      idempotencyKey,
      episodeId: body.episodeId,
      requested_provider: resolveConfiguredTtsProvider(),
      tts_provider: ttsConfig.provider,
      model: ttsConfig.model,
      voice: ttsConfig.voice,
      format: ttsConfig.format,
      speed: ttsConfig.speed
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
