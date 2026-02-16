import { ensureEpisodePair, updateEpisode, type EpisodeRecord } from "../_shared/episodeFlow.ts";
import { failJobRun, finishJobRun, startJobRun, type JobRunContext } from "../_shared/jobRuns.ts";

type StepPayload = {
  episodeDate?: string;
  idempotencyKey?: string;
};

const writeMockScript = async (episode: EpisodeRecord, episodeDate: string) => {
  if (episode.script && ["draft", "ready"].includes(episode.status)) {
    return { episodeId: episode.id, status: "skipped", reason: "script_exists" };
  }

  await updateEpisode(episode.id, { status: "generating" });
  const script = `[MOCK:${episode.lang}] Daily script for ${episodeDate}`;
  const updated = await updateEpisode(episode.id, {
    script,
    status: "draft"
  });

  return { episodeId: updated.id, status: updated.status, scriptLength: script.length };
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
    stepName: "step_generate_script",
    idempotencyKey
  };

  try {
    const start = await startJobRun(ctx, { episodeDate });
    if (start.shouldSkip) {
      return Response.json({ ok: true, skipped: true, reason: "already_succeeded" });
    }

    const pair = await ensureEpisodePair(episodeDate);
    const ja = await writeMockScript(pair.ja, episodeDate);
    const en = await writeMockScript(pair.en, episodeDate);

    await finishJobRun(ctx, "succeeded", { episodeDate, ja, en }, pair.ja.id);
    return Response.json({ ok: true, episodeDate, ja, en });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJobRun(ctx, message, { episodeDate, idempotencyKey });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
