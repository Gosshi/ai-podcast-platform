import { ensureEpisodePair } from "../_shared/episodeFlow.ts";
import { failJobRun, finishJobRun, startJobRun, type JobRunContext } from "../_shared/jobRuns.ts";

type StepPayload = {
  episodeDate?: string;
  idempotencyKey?: string;
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
    stepName: "step_prepare_episode",
    idempotencyKey
  };

  try {
    const start = await startJobRun(ctx, { episodeDate });
    if (start.shouldSkip) {
      return Response.json({ ok: true, skipped: true, reason: "already_succeeded" });
    }

    const pair = await ensureEpisodePair(episodeDate);

    await finishJobRun(ctx, "succeeded", {
      episodeDate,
      jaEpisodeId: pair.ja.id,
      enEpisodeId: pair.en.id
    }, pair.ja.id);

    return Response.json({
      ok: true,
      episodeDate,
      jaEpisodeId: pair.ja.id,
      enEpisodeId: pair.en.id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJobRun(ctx, message, { episodeDate, idempotencyKey });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
