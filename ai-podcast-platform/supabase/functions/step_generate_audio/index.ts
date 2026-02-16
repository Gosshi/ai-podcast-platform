import { ensureEpisodePair, updateEpisode, type EpisodeRecord } from "../_shared/episodeFlow.ts";
import { failJobRun, finishJobRun, startJobRun, type JobRunContext } from "../_shared/jobRuns.ts";

type StepPayload = {
  episodeDate?: string;
  idempotencyKey?: string;
};

const writeMockAudio = async (episode: EpisodeRecord) => {
  if (episode.audio_url && episode.status === "ready") {
    return { episodeId: episode.id, status: "skipped", reason: "audio_exists" };
  }

  await updateEpisode(episode.id, { status: "generating" });
  const audioUrl = `https://staging.local/audio/${episode.id}.mp3`;
  const updated = await updateEpisode(episode.id, {
    audio_url: audioUrl,
    status: "ready"
  });

  return { episodeId: updated.id, status: updated.status, audioUrl };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = (await req.json().catch(() => ({}))) as StepPayload;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily:${episodeDate}`;
  const ctx: JobRunContext = {
    jobName: "daily_generate",
    stepName: "step_generate_audio",
    idempotencyKey
  };

  try {
    const start = await startJobRun(ctx, { episodeDate });
    if (start.shouldSkip) {
      return Response.json({ ok: true, skipped: true, reason: "already_succeeded" });
    }

    const pair = await ensureEpisodePair(episodeDate);
    const ja = await writeMockAudio(pair.ja);
    const en = await writeMockAudio(pair.en);

    await finishJobRun(ctx, "succeeded", { episodeDate, ja, en }, pair.ja.id);
    return Response.json({ ok: true, episodeDate, ja, en });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJobRun(ctx, message, { episodeDate, idempotencyKey });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
