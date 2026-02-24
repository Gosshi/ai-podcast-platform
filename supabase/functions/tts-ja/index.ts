import { countFailedRunsForAudioVersion, failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { fetchEpisodeById, resolveEpisodeScriptForAudio, updateEpisode } from "../_shared/episodes.ts";
import {
  buildAudioVersion,
  hasVersionedAudioUrl,
  resolveConfiguredTtsProvider,
  resolveTtsSignatureConfig
} from "../_shared/audioVersion.ts";
import { synthesizeEpisodeAudio, TTS_API_TIMEOUT_MS, TtsRequestError } from "../_shared/localTts.ts";
import { isTtsPreprocessEnabled, preprocessForTTS } from "../_shared/ttsPreprocess.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  episodeId?: string;
};

const MAX_FAILED_TTS_ATTEMPTS = 3;

const buildForcedAudioVersion = (baseVersion: string): string => {
  const revision = Date.now().toString(36);
  return `${baseVersion}${revision}`.slice(0, 64);
};

const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeStepError = (error: unknown): {
  status: number;
  errorType: string;
  message: string;
  jobRunError: string;
} => {
  if (error instanceof TtsRequestError) {
    const payload = error.responsePayload;
    return {
      status: error.status,
      errorType: error.errorType,
      message: error.message,
      jobRunError:
        payload !== null
          ? safeJsonStringify(payload)
          : safeJsonStringify({
              ok: false,
              errorType: error.errorType,
              message: error.message,
              status: error.status,
              apiUrl: error.apiUrl
            })
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    status: 500,
    errorType: "tts_ja_failed",
    message,
    jobRunError: safeJsonStringify({ ok: false, errorType: "tts_ja_failed", message })
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, errorType: "method_not_allowed", message: "Method not allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  if (!body.episodeId) {
    return jsonResponse({ ok: false, errorType: "invalid_request", message: "episodeId is required" }, 400);
  }

  const startedAtMs = Date.now();
  const runId = await startRun("tts-ja", {
    step: "tts-ja",
    lang: "ja",
    episodeDate,
    idempotencyKey,
    episodeId: body.episodeId,
    timeout_ms: TTS_API_TIMEOUT_MS
  });

  let attempt = 1;
  let audioVersion: string | null = null;

  try {
    const episode = await fetchEpisodeById(body.episodeId);
    const script = resolveEpisodeScriptForAudio(episode);
    const ttsPreprocessEnabled = isTtsPreprocessEnabled();
    const ttsPreprocessResult = ttsPreprocessEnabled
      ? preprocessForTTS(script, "ja")
      : {
          text: script,
          changed: false,
          metrics: {
            urlReplacedCount: 0,
            bracketRemovedCount: 0,
            mappedWordCount: 0,
            pauseInsertedCount: 0
          }
        };
    const scriptForTts = ttsPreprocessResult.text;
    const ttsConfig = resolveTtsSignatureConfig("ja");
    const baseAudioVersion = await buildAudioVersion(scriptForTts, ttsConfig);
    const failureCount = await countFailedRunsForAudioVersion({
      jobType: "tts-ja",
      episodeId: episode.id,
      audioVersion: baseAudioVersion
    });
    attempt = failureCount + 1;

    if (failureCount >= MAX_FAILED_TTS_ATTEMPTS) {
      const durationMs = Date.now() - startedAtMs;
      const errorType = "failure_limit_reached";
      const message = `tts-ja aborted: ${failureCount} failed attempts for this episode/audioVersion`;

      await failRun(
        runId,
        safeJsonStringify({ ok: false, errorType, message, attempt }),
        {
          step: "tts-ja",
          lang: "ja",
          episodeDate,
          idempotencyKey,
          episodeId: episode.id,
          audioVersion: baseAudioVersion,
          attempt,
          duration_ms: durationMs,
          timeout_ms: TTS_API_TIMEOUT_MS,
          provider: ttsConfig.provider,
          model: ttsConfig.model,
          tts_preprocess_enabled: ttsPreprocessEnabled,
          tts_preprocess_applied: ttsPreprocessResult.changed,
          tts_preprocess_url_replaced_count: ttsPreprocessResult.metrics.urlReplacedCount,
          tts_preprocess_bracket_removed_count: ttsPreprocessResult.metrics.bracketRemovedCount,
          tts_preprocess_mapped_word_count: ttsPreprocessResult.metrics.mappedWordCount,
          tts_preprocess_pause_inserted_count: ttsPreprocessResult.metrics.pauseInsertedCount,
          voice: ttsConfig.voice,
          format: ttsConfig.format,
          speed: ttsConfig.speed,
          blocked_by_failure_limit: true
        }
      );

      return jsonResponse({ ok: false, errorType, message, attempt }, 429);
    }

    const forceLocalTts = Deno.env.get("LOCAL_TTS_ENABLED") === "1";
    audioVersion = forceLocalTts ? buildForcedAudioVersion(baseAudioVersion) : baseAudioVersion;
    const hasCurrentVersionAudio = hasVersionedAudioUrl({
      episodeId: episode.id,
      lang: "ja",
      audioVersion: baseAudioVersion,
      audioUrl: episode.audio_url
    });

    if (!forceLocalTts && hasCurrentVersionAudio) {
      const durationMs = Date.now() - startedAtMs;
      await finishRun(runId, {
        step: "tts-ja",
        lang: "ja",
        episodeDate,
        idempotencyKey,
        episodeId: episode.id,
        noOp: true,
        reason: "audio_exists_for_version",
        audioVersion: baseAudioVersion,
        attempt,
        duration_ms: durationMs,
        timeout_ms: TTS_API_TIMEOUT_MS,
        provider: ttsConfig.provider,
        model: ttsConfig.model,
        tts_preprocess_enabled: ttsPreprocessEnabled,
        tts_preprocess_applied: ttsPreprocessResult.changed,
        tts_preprocess_url_replaced_count: ttsPreprocessResult.metrics.urlReplacedCount,
        tts_preprocess_bracket_removed_count: ttsPreprocessResult.metrics.bracketRemovedCount,
        tts_preprocess_mapped_word_count: ttsPreprocessResult.metrics.mappedWordCount,
        tts_preprocess_pause_inserted_count: ttsPreprocessResult.metrics.pauseInsertedCount,
        tts_provider: ttsConfig.provider,
        voice: ttsConfig.voice,
        format: ttsConfig.format,
        speed: ttsConfig.speed
      });

      return jsonResponse({ ok: true, episodeId: episode.id, noOp: true, attempt });
    }

    await updateEpisode(episode.id, { status: "generating" });
    const synthesized = await synthesizeEpisodeAudio({
      episodeId: episode.id,
      lang: "ja",
      audioVersion,
      text: scriptForTts
    });
    const audioUrl = synthesized.audioUrl;
    const updated = await updateEpisode(episode.id, {
      audio_url: audioUrl,
      duration_sec: synthesized.durationSec,
      status: "ready"
    });

    const durationMs = Date.now() - startedAtMs;
    await finishRun(runId, {
      step: "tts-ja",
      lang: "ja",
      episodeDate,
      idempotencyKey,
      episodeId: updated.id,
      noOp: false,
      audioVersion,
      audioUrl,
      attempt,
      duration_ms: durationMs,
      timeout_ms: TTS_API_TIMEOUT_MS,
      provider: synthesized.provider,
      model: synthesized.model,
      tts_preprocess_enabled: ttsPreprocessEnabled,
      tts_preprocess_applied: ttsPreprocessResult.changed,
      tts_preprocess_url_replaced_count: ttsPreprocessResult.metrics.urlReplacedCount,
      tts_preprocess_bracket_removed_count: ttsPreprocessResult.metrics.bracketRemovedCount,
      tts_preprocess_mapped_word_count: ttsPreprocessResult.metrics.mappedWordCount,
      tts_preprocess_pause_inserted_count: ttsPreprocessResult.metrics.pauseInsertedCount,
      tts_provider: synthesized.provider,
      requested_provider: synthesized.requestedProvider,
      voice: synthesized.voice,
      format: synthesized.format,
      speed: ttsConfig.speed,
      fallback_reason: synthesized.fallbackReason
    });

    return jsonResponse({ ok: true, episodeId: updated.id, audioUrl, status: updated.status, attempt });
  } catch (error) {
    const ttsConfig = resolveTtsSignatureConfig("ja");
    const durationMs = Date.now() - startedAtMs;
    const normalized = normalizeStepError(error);

    await failRun(runId, normalized.jobRunError, {
      step: "tts-ja",
      lang: "ja",
      episodeDate,
      idempotencyKey,
      episodeId: body.episodeId,
      audioVersion,
      attempt,
      duration_ms: durationMs,
      timeout_ms: TTS_API_TIMEOUT_MS,
      provider: ttsConfig.provider,
      model: ttsConfig.model,
      requested_provider: resolveConfiguredTtsProvider(),
      tts_provider: ttsConfig.provider,
      voice: ttsConfig.voice,
      format: ttsConfig.format,
      speed: ttsConfig.speed
    });

    return jsonResponse(
      {
        ok: false,
        errorType: normalized.errorType,
        message: normalized.message
      },
      normalized.status
    );
  }
});
