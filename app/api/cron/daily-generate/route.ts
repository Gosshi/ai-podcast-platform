export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const resolveJstTodayDate = (): string => {
  const now = new Date();
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveSupabaseUrl = (): string | null => {
  const value = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return value ? value.replace(/\/$/, "") : null;
};

const resolveFunctionsBaseUrl = (supabaseUrl: string | null): string | null => {
  if (process.env.SUPABASE_FUNCTIONS_URL) {
    return process.env.SUPABASE_FUNCTIONS_URL.replace(/\/$/, "");
  }
  return supabaseUrl ? `${supabaseUrl}/functions/v1` : null;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return jsonResponse({ ok: false, error: "cron_secret_not_configured" }, 503);
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (token !== cronSecret) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = resolveSupabaseUrl();
  const functionsBaseUrl = resolveFunctionsBaseUrl(supabaseUrl);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const episodeDate = resolveJstTodayDate();

  if (!functionsBaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: "not_configured", episodeDate },
      503
    );
  }

  try {
    const response = await fetch(`${functionsBaseUrl}/daily-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey
      },
      body: JSON.stringify({ episodeDate }),
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => ({}))) as unknown;
    const runId = isRecord(payload) && typeof payload.runId === "string" ? payload.runId : null;
    const ok = response.ok && isRecord(payload) && payload.ok === true;
    const error = isRecord(payload) && typeof payload.error === "string" ? payload.error : null;

    return jsonResponse({
      ok,
      episodeDate,
      runId,
      status: response.status,
      error: ok ? null : error ?? `daily_generate_http_${response.status}`
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        episodeDate,
        runId: null,
        status: 502,
        error: err instanceof Error ? err.message : "daily_generate_request_failed"
      },
      502
    );
  }
}
