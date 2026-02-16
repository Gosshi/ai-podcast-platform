import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  fetchEpisodeById,
  findEnglishEpisodeByMasterId,
  insertEnglishEpisode,
  updateEpisode
} from "../_shared/episodes.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  masterEpisodeId?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  if (!body.masterEpisodeId) {
    return jsonResponse({ ok: false, error: "masterEpisodeId is required" }, 400);
  }

  const runId = await startRun("adapt-script-en", {
    step: "adapt-script-en",
    episodeDate,
    idempotencyKey,
    masterEpisodeId: body.masterEpisodeId
  });

  try {
    const ja = await fetchEpisodeById(body.masterEpisodeId);
    const title = (ja.title ?? `Episode ${episodeDate}`)
      .replace(/\s*\(JA\)\s*$/, "")
      .concat(" (EN)");
    const description = `English adaptation for ${episodeDate}`;
    const script = ja.script ? `[EN ADAPT]\n${ja.script}` : `[EN ADAPT] missing ja script for ${episodeDate}`;

    let en = await findEnglishEpisodeByMasterId(ja.id);

    if (!en) {
      en = await insertEnglishEpisode({
        masterId: ja.id,
        title,
        description,
        script
      });
    } else if (!en.script || en.status === "failed") {
      await updateEpisode(en.id, { status: "generating" });
      en = await updateEpisode(en.id, {
        script,
        description,
        status: "draft"
      });
    }

    await finishRun(runId, {
      step: "adapt-script-en",
      episodeDate,
      idempotencyKey,
      masterEpisodeId: ja.id,
      episodeId: en.id,
      status: en.status
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      masterEpisodeId: ja.id,
      episodeId: en.id,
      status: en.status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "adapt-script-en",
      episodeDate,
      idempotencyKey,
      masterEpisodeId: body.masterEpisodeId
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
