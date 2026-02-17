import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
};

type InvokeResult = {
  ok?: boolean;
  [key: string]: unknown;
};

const orderedSteps = [
  "plan-topics",
  "write-script-ja",
  "tts-ja",
  "adapt-script-en",
  "tts-en",
  "publish"
] as const;

const getFunctionsBaseUrl = (requestUrl: string): string => {
  const explicit = Deno.env.get("FUNCTIONS_BASE_URL") ?? Deno.env.get("SUPABASE_FUNCTIONS_URL");
  if (explicit) return explicit;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1`;
  }

  return `${new URL(requestUrl).origin}/functions/v1`;
};

const invokeStep = async (
  functionsBaseUrl: string,
  step: (typeof orderedSteps)[number],
  payload: Record<string, unknown>
): Promise<InvokeResult> => {
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const response = await fetch(`${functionsBaseUrl}/${step}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRole}`
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json().catch(() => ({}))) as InvokeResult;

  if (!response.ok || body.ok === false) {
    throw new Error(`step_failed:${step}`);
  }

  return body;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  const runId = await startRun("daily-generate", {
    step: "daily-generate",
    episodeDate,
    idempotencyKey,
    orderedSteps
  });

  try {
    const functionsBaseUrl = getFunctionsBaseUrl(req.url);
    const plan = await invokeStep(functionsBaseUrl, "plan-topics", { episodeDate, idempotencyKey });

    const writeJa = await invokeStep(functionsBaseUrl, "write-script-ja", {
      episodeDate,
      idempotencyKey,
      topic: plan.topic
    });

    const ttsJa = await invokeStep(functionsBaseUrl, "tts-ja", {
      episodeDate,
      idempotencyKey,
      episodeId: writeJa.episodeId
    });

    const adaptEn = await invokeStep(functionsBaseUrl, "adapt-script-en", {
      episodeDate,
      idempotencyKey,
      masterEpisodeId: writeJa.episodeId
    });

    const ttsEn = await invokeStep(functionsBaseUrl, "tts-en", {
      episodeDate,
      idempotencyKey,
      episodeId: adaptEn.episodeId
    });

    const publish = await invokeStep(functionsBaseUrl, "publish", {
      episodeDate,
      idempotencyKey,
      episodeIdJa: ttsJa.episodeId,
      episodeIdEn: ttsEn.episodeId
    });

    await finishRun(runId, {
      step: "daily-generate",
      episodeDate,
      idempotencyKey,
      orderedSteps,
      outputs: {
        plan,
        writeJa,
        ttsJa,
        adaptEn,
        ttsEn,
        publish
      }
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      outputs: {
        plan,
        writeJa,
        ttsJa,
        adaptEn,
        ttsEn,
        publish
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "daily-generate",
      episodeDate,
      idempotencyKey,
      orderedSteps
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
