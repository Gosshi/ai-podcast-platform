import { supabaseAdmin } from "./supabaseAdmin.ts";

export const startRun = async (
  jobType: string,
  payload: Record<string, unknown>
): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from("job_runs")
    .insert({
      job_type: jobType,
      status: "running",
      payload
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw error ?? new Error("failed to insert job_runs row");
  }

  return String(data.id);
};

export const finishRun = async (
  runId: string,
  payload: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("job_runs")
    .update({
      status: "success",
      payload,
      ended_at: new Date().toISOString()
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
};

export const failRun = async (
  runId: string,
  errorMessage: string,
  payload: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("job_runs")
    .update({
      status: "failed",
      payload,
      error: errorMessage,
      ended_at: new Date().toISOString()
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
};

export const skipRun = async (
  runId: string,
  reason: string,
  payload: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("job_runs")
    .update({
      status: "skipped",
      payload: {
        ...payload,
        reason
      },
      error: null,
      ended_at: new Date().toISOString()
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
};

export const countFailedRunsForAudioVersion = async (params: {
  jobType: string;
  episodeId: string;
  audioVersion: string;
}): Promise<number> => {
  const { count, error } = await supabaseAdmin
    .from("job_runs")
    .select("id", { count: "exact", head: true })
    .eq("job_type", params.jobType)
    .eq("status", "failed")
    .filter("payload->>episodeId", "eq", params.episodeId)
    .filter("payload->>audioVersion", "eq", params.audioVersion);

  if (error) {
    throw error;
  }

  return count ?? 0;
};
