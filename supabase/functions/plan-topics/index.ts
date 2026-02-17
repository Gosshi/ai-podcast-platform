import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  const runId = await startRun("plan-topics", {
    step: "plan-topics",
    episodeDate,
    idempotencyKey
  });

  try {
    const topic = {
      title: `Staging Topic ${episodeDate}`,
      bullets: [
        "MVP progress summary",
        "Behind the scenes",
        "Next build targets"
      ]
    };

    await finishRun(runId, {
      step: "plan-topics",
      episodeDate,
      idempotencyKey,
      topic
    });

    return jsonResponse({ ok: true, episodeDate, idempotencyKey, topic });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "plan-topics",
      episodeDate,
      idempotencyKey
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
