import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const dynamic = "force-dynamic";

type JobRunRow = {
  id: string;
  job_type: string;
  status: "running" | "success" | "failed";
  payload: unknown;
  error: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type SearchParams = {
  status?: string;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { hour12: false });
};

const formatPayload = (payload: unknown): string => {
  try {
    return JSON.stringify(payload ?? {}, null, 2);
  } catch {
    return String(payload ?? "");
  }
};

const loadJobRuns = async (failedOnly: boolean): Promise<{ data: JobRunRow[]; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    let query = supabase
      .from("job_runs")
      .select("id, job_type, status, payload, error, created_at, started_at, ended_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (failedOnly) {
      query = query.eq("status", "failed");
    }

    const { data, error } = await query;
    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as JobRunRow[]) ?? [], error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "unknown_error" };
  }
};

export default async function JobRunsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const failedOnly = params.status === "failed";
  const { data, error } = await loadJobRuns(failedOnly);

  return (
    <main>
      {/* TODO: add auth guard before enabling outside local-only operation. */}
      <h1>Job Runs Audit (Local)</h1>
      <p>Recent orchestration runs from `job_runs`.</p>
      <p>
        Filter: {failedOnly ? "failed only" : "all"} [{" "}
        {failedOnly ? <a href="/admin/job-runs">show all</a> : <a href="/admin/job-runs?status=failed">failed only</a>}
        ]
      </p>

      {error ? <p>Failed to load job runs: {error}</p> : null}
      {data.length === 0 ? (
        <p>No job runs found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Created At</th>
              <th>Job Type</th>
              <th>Status</th>
              <th>Error</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data.map((run) => (
              <tr key={run.id}>
                <td>{formatDateTime(run.created_at)}</td>
                <td>{run.job_type}</td>
                <td>{run.status}</td>
                <td>{run.error ?? "-"}</td>
                <td>
                  <details>
                    <summary>view</summary>
                    <pre>
{`id: ${run.id}
started_at: ${formatDateTime(run.started_at)}
ended_at: ${formatDateTime(run.ended_at)}
payload:\n${formatPayload(run.payload)}`}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
