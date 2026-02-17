import { failRun, finishRun, startRun } from "../_shared/jobRuns";
import { jsonResponse } from "../_shared/http";
import {
  findJapaneseEpisodeByTitle,
  insertJapaneseEpisode,
  updateEpisode
} from "../_shared/episodes";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  topic?: {
    title?: string;
    bullets?: string[];
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const topicTitle = body.topic?.title ?? `Staging Topic ${episodeDate}`;
  const bullets = body.topic?.bullets ?? ["MVP progress summary", "Behind the scenes", "Next build targets"];
  const title = `${topicTitle} (JA)`;
  const description = `Japanese episode for ${episodeDate}`;
  const script = `# ${topicTitle}\n\n- ${bullets.join("\n- ")}`;

  const runId = await startRun("write-script-ja", {
    step: "write-script-ja",
    episodeDate,
    idempotencyKey,
    title
  });

  try {
    let episode = await findJapaneseEpisodeByTitle(title);

    if (!episode) {
      episode = await insertJapaneseEpisode({ title, description, script });
    } else if (!episode.script || episode.status === "failed") {
      await updateEpisode(episode.id, { status: "generating" });
      episode = await updateEpisode(episode.id, {
        script,
        description,
        status: "draft"
      });
    }

    await finishRun(runId, {
      step: "write-script-ja",
      episodeDate,
      idempotencyKey,
      episodeId: episode.id,
      status: episode.status,
      noOp: Boolean(episode.script)
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      episodeId: episode.id,
      title: episode.title,
      status: episode.status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "write-script-ja",
      episodeDate,
      idempotencyKey,
      title
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
