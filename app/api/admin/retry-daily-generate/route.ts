import { NextRequest, NextResponse } from "next/server";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type RetryResponse = {
  ok: boolean;
  disabled?: boolean;
  episodeDate: string;
  runId: string | null;
  status: number;
  error: string | null;
};

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

  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl}/functions/v1`;
};

const isLocalRetryAllowed = (supabaseUrl: string | null): boolean => {
  if (process.env.ENABLE_OPS_RETRY === "true") {
    return true;
  }

  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (!supabaseUrl) {
    return false;
  }

  return supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");
};

const buildResponse = (value: RetryResponse, status?: number) => {
  return NextResponse.json(value, { status: status ?? 200 });
};

export async function POST(req: NextRequest) {
  const supabaseUrl = resolveSupabaseUrl();
  const functionsBaseUrl = resolveFunctionsBaseUrl(supabaseUrl);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  const fallbackEpisodeDate = resolveJstTodayDate();
  const body = (await req.json().catch(() => ({}))) as unknown;
  const requestedDate = isRecord(body) && typeof body.episodeDate === "string" ? body.episodeDate : null;
  const episodeDate = requestedDate && DATE_PATTERN.test(requestedDate) ? requestedDate : fallbackEpisodeDate;

  if (!isLocalRetryAllowed(supabaseUrl)) {
    return buildResponse(
      {
        ok: false,
        disabled: true,
        episodeDate,
        runId: null,
        status: 403,
        error: "retry_disabled_outside_local"
      },
      403
    );
  }

  if (!functionsBaseUrl || !serviceRoleKey) {
    return buildResponse(
      {
        ok: false,
        disabled: true,
        episodeDate,
        runId: null,
        status: 503,
        error: "retry_not_configured"
      },
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

    return buildResponse({
      ok,
      episodeDate,
      runId,
      status: response.status,
      error: ok ? null : error ?? `daily_generate_http_${response.status}`
    });
  } catch (error) {
    return buildResponse(
      {
        ok: false,
        episodeDate,
        runId: null,
        status: 502,
        error: error instanceof Error ? error.message : "daily_generate_request_failed"
      },
      502
    );
  }
}
