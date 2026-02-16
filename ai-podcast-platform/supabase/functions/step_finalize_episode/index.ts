import { ensureEpisodePair, updateEpisode } from "../_shared/episodeFlow.ts";
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
    stepName: "step_finalize_episode",
    idempotencyKey
  };

  try {
    const start = await startJobRun(ctx, { episodeDate });
    if (start.shouldSkip) {
      return Response.json({ ok: true, skipped: true, reason: "already_succeeded" });
    }

    const pair = await ensureEpisodePair(episodeDate);

    if (pair.ja.status !== "ready" || pair.en.status !== "ready") {
      throw new Error("both episodes must be ready before finalize");
    }

    const nowIso = new Date().toISOString();
    const ja = pair.ja.published_at
      ? pair.ja
      : await updateEpisode(pair.ja.id, { status: "ready", published_at: nowIso });
    const en = pair.en.published_at
      ? pair.en
      : await updateEpisode(pair.en.id, { status: "ready", published_at: nowIso });

    await finishJobRun(ctx, "succeeded", {
      episodeDate,
      jaEpisodeId: ja.id,
      enEpisodeId: en.id,
      publishedAt: nowIso
    }, ja.id);

    return Response.json({ ok: true, episodeDate, jaEpisodeId: ja.id, enEpisodeId: en.id, publishedAt: nowIso });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJobRun(ctx, message, { episodeDate, idempotencyKey });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
