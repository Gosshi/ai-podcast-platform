import { failJobRun, finishJobRun, startJobRun, type JobRunContext } from "../_shared/jobRuns.ts";

type DailyGeneratePayload = {
  episodeDate?: string;
  idempotencyKey?: string;
};

const steps = [
  "step_prepare_episode",
  "step_generate_script",
  "step_generate_audio",
  "step_finalize_episode"
] as const;

const getFunctionsBaseUrl = () => {
  const explicit = Deno.env.get("SUPABASE_FUNCTIONS_URL");
  if (explicit) return explicit;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or SUPABASE_FUNCTIONS_URL is required.");
  }

  return `${supabaseUrl}/functions/v1`;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = (await req.json().catch(() => ({}))) as DailyGeneratePayload;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily:${episodeDate}`;

  const ctx: JobRunContext = {
    jobName: "daily_generate",
    stepName: "orchestrate",
    idempotencyKey
  };

  try {
    const start = await startJobRun(ctx, { episodeDate, steps });
    if (start.shouldSkip) {
      return Response.json({ ok: true, skipped: true, reason: "already_succeeded" });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
    }

    const baseUrl = getFunctionsBaseUrl();
    const outputs: Array<Record<string, unknown>> = [];

    for (const step of steps) {
      const response = await fetch(`${baseUrl}/${step}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ episodeDate, idempotencyKey })
      });

      const result = await response.json().catch(() => ({}));
      outputs.push({ step, status: response.status, result });

      if (!response.ok) {
        throw new Error(`step_failed:${step}`);
      }
    }

    await finishJobRun(ctx, "succeeded", { episodeDate, outputs });
    return Response.json({ ok: true, episodeDate, outputs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJobRun(ctx, message, { episodeDate, idempotencyKey });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
