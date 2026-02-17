import { failRun, finishRun, startRun } from "../_shared/jobRuns";
import { jsonResponse } from "../_shared/http";
import { fetchEpisodeById, updateEpisode } from "../_shared/episodes";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  episodeIdJa?: string;
  episodeIdEn?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  if (!body.episodeIdJa || !body.episodeIdEn) {
    return jsonResponse({ ok: false, error: "episodeIdJa and episodeIdEn are required" }, 400);
  }

  const runId = await startRun("publish", {
    step: "publish",
    episodeDate,
    idempotencyKey,
    episodeIdJa: body.episodeIdJa,
    episodeIdEn: body.episodeIdEn
  });

  try {
    const ja = await fetchEpisodeById(body.episodeIdJa);
    const en = await fetchEpisodeById(body.episodeIdEn);

    if (!ja.audio_url || !en.audio_url) {
      throw new Error("audio_url must exist for both ja/en episodes before publish");
    }

    const nowIso = new Date().toISOString();
    const publishedJa =
      ja.status === "published" && ja.published_at
        ? ja
        : await updateEpisode(ja.id, { status: "published", published_at: nowIso });

    const publishedEn =
      en.status === "published" && en.published_at
        ? en
        : await updateEpisode(en.id, { status: "published", published_at: nowIso });

    await finishRun(runId, {
      step: "publish",
      episodeDate,
      idempotencyKey,
      episodeIdJa: publishedJa.id,
      episodeIdEn: publishedEn.id,
      statusJa: publishedJa.status,
      statusEn: publishedEn.status,
      publishedAtJa: publishedJa.published_at,
      publishedAtEn: publishedEn.published_at
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      episodeIdJa: publishedJa.id,
      episodeIdEn: publishedEn.id,
      statusJa: publishedJa.status,
      statusEn: publishedEn.status,
      publishedAtJa: publishedJa.published_at,
      publishedAtEn: publishedEn.published_at
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "publish",
      episodeDate,
      idempotencyKey,
      episodeIdJa: body.episodeIdJa,
      episodeIdEn: body.episodeIdEn
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
