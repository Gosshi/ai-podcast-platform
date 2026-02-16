import { supabaseAdmin } from "./supabaseAdmin.ts";

type JobStatus = "started" | "succeeded" | "failed" | "skipped";

export type JobRunContext = {
  jobName: string;
  stepName: string;
  idempotencyKey: string;
};

type JobRunPayload = Record<string, unknown>;

const matchRun = (query: any, ctx: JobRunContext) => {
  return query
    .eq("job_name", ctx.jobName)
    .eq("step_name", ctx.stepName)
    .eq("idempotency_key", ctx.idempotencyKey);
};

export const startJobRun = async (
  ctx: JobRunContext,
  payload: JobRunPayload,
  episodeId?: string
): Promise<{ shouldSkip: boolean; status: JobStatus | null }> => {
  const existingQuery = supabaseAdmin
    .from("job_runs")
    .select("status")
    .limit(1)
    .maybeSingle();
  const existingResult = await matchRun(existingQuery, ctx);

  if (existingResult.error) {
    throw existingResult.error;
  }

  const existingStatus = (existingResult.data?.status as JobStatus | undefined) ?? null;
  if (existingStatus === "succeeded" || existingStatus === "skipped") {
    return { shouldSkip: true, status: existingStatus };
  }

  const upsertResult = await supabaseAdmin
    .from("job_runs")
    .upsert(
      {
        job_name: ctx.jobName,
        step_name: ctx.stepName,
        idempotency_key: ctx.idempotencyKey,
        status: "started",
        payload,
        episode_id: episodeId,
        error: null,
        finished_at: null
      },
      { onConflict: "job_name,step_name,idempotency_key" }
    )
    .select("status")
    .single();

  if (upsertResult.error) {
    throw upsertResult.error;
  }

  return { shouldSkip: false, status: (upsertResult.data?.status as JobStatus | null) ?? null };
};

export const finishJobRun = async (
  ctx: JobRunContext,
  status: Extract<JobStatus, "succeeded" | "skipped">,
  payload: JobRunPayload,
  episodeId?: string
): Promise<void> => {
  const updateQuery = supabaseAdmin
    .from("job_runs")
    .update({
      status,
      payload,
      episode_id: episodeId,
      error: null,
      finished_at: new Date().toISOString()
    });
  const updateResult = await matchRun(updateQuery, ctx);

  if (updateResult.error) {
    throw updateResult.error;
  }
};

export const failJobRun = async (
  ctx: JobRunContext,
  errorMessage: string,
  payload: JobRunPayload,
  episodeId?: string
): Promise<void> => {
  const updateQuery = supabaseAdmin
    .from("job_runs")
    .update({
      status: "failed",
      payload,
      episode_id: episodeId,
      error: errorMessage,
      finished_at: new Date().toISOString()
    });
  const updateResult = await matchRun(updateQuery, ctx);

  if (updateResult.error) {
    throw updateResult.error;
  }
};
