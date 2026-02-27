import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  fetchEpisodeById,
  findPublishedEpisodeByJstDate,
  updateEpisode
} from "../_shared/episodes.ts";
import { normalizeGenre } from "../../../src/lib/genre/allowedGenres.ts";

type RequestBody = {
  episodeDate?: string;
  genre?: string;
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
  const requestedGenre =
    typeof body.genre === "string" ? normalizeGenre(body.genre) || "general" : null;
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  if (!body.episodeIdJa || !body.episodeIdEn) {
    return jsonResponse({ ok: false, error: "episodeIdJa and episodeIdEn are required" }, 400);
  }

  const runId = await startRun("publish", {
    step: "publish",
    episodeDate,
    genre: requestedGenre,
    idempotencyKey,
    episodeIdJa: body.episodeIdJa,
    episodeIdEn: body.episodeIdEn
  });

  try {
    const ja = await fetchEpisodeById(body.episodeIdJa);
    const en = await fetchEpisodeById(body.episodeIdEn);
    const genre =
      requestedGenre ??
      (typeof ja.genre === "string" ? normalizeGenre(ja.genre) : "general");

    if (!ja.audio_url || !en.audio_url) {
      throw new Error("audio_url must exist for both ja/en episodes before publish");
    }

    const [publishedJaForDate, publishedEnForDate] = await Promise.all([
      findPublishedEpisodeByJstDate({
        episodeDate,
        lang: "ja",
        excludeEpisodeId: ja.id
      }),
      findPublishedEpisodeByJstDate({
        episodeDate,
        lang: "en",
        excludeEpisodeId: en.id
      })
    ]);

    if (publishedJaForDate || publishedEnForDate) {
      await finishRun(runId, {
        step: "publish",
        episodeDate,
        genre,
        idempotencyKey,
        episodeIdJa: ja.id,
        episodeIdEn: en.id,
        noOp: true,
        reason: "already_published_for_jst_date",
        existingPublishedEpisodeIdJa: publishedJaForDate?.id ?? null,
        existingPublishedEpisodeIdEn: publishedEnForDate?.id ?? null
      });

      return jsonResponse({
        ok: true,
        episodeDate,
        genre,
        episodeIdJa: ja.id,
        episodeIdEn: en.id,
        noOp: true,
        reason: "already_published_for_jst_date",
        existingPublishedEpisodeIdJa: publishedJaForDate?.id ?? null,
        existingPublishedEpisodeIdEn: publishedEnForDate?.id ?? null
      });
    }

    const nowIso = new Date().toISOString();
    const publishedJa =
      ja.status === "published" && ja.published_at
        ? ja
        : await updateEpisode(ja.id, {
            status: "published",
            published_at: nowIso,
            episode_date: episodeDate,
            genre
          });

    const publishedEn =
      en.status === "published" && en.published_at
        ? en
        : await updateEpisode(en.id, {
            status: "published",
            published_at: nowIso,
            episode_date: episodeDate,
            genre
          });

    await finishRun(runId, {
      step: "publish",
      episodeDate,
      genre,
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
      genre,
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
      genre: requestedGenre,
      idempotencyKey,
      episodeIdJa: body.episodeIdJa,
      episodeIdEn: body.episodeIdEn
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
