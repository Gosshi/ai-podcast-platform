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
