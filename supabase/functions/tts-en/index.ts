import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { fetchEpisodeById, updateEpisode } from "../_shared/episodes.ts";
import { buildAudioVersion, buildLocalAudioUrl } from "../_shared/audioVersion.ts";
import { synthesizeLocalAudio } from "../_shared/localTts.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  episodeId?: string;
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

  const runId = await startRun("tts-en", {
    step: "tts-en",
    episodeDate,
    idempotencyKey,
    episodeId: body.episodeId
  });

  try {
    const episode = await fetchEpisodeById(body.episodeId);
    const script = episode.script ?? episode.title ?? "";
    const audioVersion = await buildAudioVersion(script);
    const expectedLocalAudioUrl = buildLocalAudioUrl({
      episodeId: episode.id,
      lang: "en",
      audioVersion
    });

    if (episode.audio_url === expectedLocalAudioUrl) {
      await finishRun(runId, {
        step: "tts-en",
        episodeDate,
        idempotencyKey,
        episodeId: episode.id,
        noOp: true,
        reason: "local_audio_exists"
      });

      return jsonResponse({ ok: true, episodeId: episode.id, noOp: true });
    }

    await updateEpisode(episode.id, { status: "generating" });
    const synthesized = await synthesizeLocalAudio({
      episodeId: episode.id,
      lang: "en",
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
      step: "tts-en",
      episodeDate,
      idempotencyKey,
      episodeId: updated.id,
      noOp: false,
      audioUrl
    });

    return jsonResponse({ ok: true, episodeId: updated.id, audioUrl, status: updated.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "tts-en",
      episodeDate,
      idempotencyKey,
      episodeId: body.episodeId
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
