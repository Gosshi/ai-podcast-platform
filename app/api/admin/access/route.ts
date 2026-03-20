import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { getViewerFromCookies } from "@/app/lib/viewer";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS,
  createAdminAccessCookieValue,
  isAdminAccessGateEnabled,
  isValidAdminPasscode,
  normalizeAdminNextPath
} from "@/app/lib/adminAccess";
import { resolveAdminEmails } from "@/app/lib/adminGuard";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

const MAX_ADMIN_ACCESS_FAILURES = 10;
const LOCKOUT_MINUTES = 30;

type AdminAccessRequest = {
  passcode?: unknown;
  next?: unknown;
};

type AdminAccessAttemptRow = {
  user_id: string;
  failed_attempts: number;
  locked_until: string | null;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status });

const readFailureState = async (userId: string): Promise<AdminAccessAttemptRow | null> => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_access_attempts")
    .select("user_id, failed_attempts, locked_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AdminAccessAttemptRow | null) ?? null;
};

const resetFailureState = async (userId: string): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("admin_access_attempts").upsert(
    {
      user_id: userId,
      failed_attempts: 0,
      locked_until: null,
      last_failed_at: null
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
};

const recordFailure = async (userId: string, currentFailures: number): Promise<{ lockedUntil: string | null }> => {
  const failedAttempts = currentFailures + 1;
  const lockedUntil =
    failedAttempts >= MAX_ADMIN_ACCESS_FAILURES
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("admin_access_attempts").upsert(
    {
      user_id: userId,
      failed_attempts: failedAttempts,
      locked_until: lockedUntil,
      last_failed_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }

  return { lockedUntil };
};

export async function POST(request: Request) {
  if (!isAdminAccessGateEnabled()) {
    return json({ ok: false, error: "admin_access_not_configured" }, 503);
  }

  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return json({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const adminEmails = resolveAdminEmails();
  if (!viewer.email || !adminEmails.has(viewer.email.toLowerCase())) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as AdminAccessRequest;
  const passcode = typeof body.passcode === "string" ? body.passcode : "";
  const nextPath = normalizeAdminNextPath(typeof body.next === "string" ? body.next : null);

  if (!passcode.trim()) {
    return json({ ok: false, error: "passcode_required" }, 400);
  }

  const failureState = await readFailureState(viewer.userId);
  const lockedUntil = failureState?.locked_until ? new Date(failureState.locked_until) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return json(
      {
        ok: false,
        error: "admin_access_locked",
        lockedUntil: lockedUntil.toISOString()
      },
      423
    );
  }

  if (!isValidAdminPasscode(passcode)) {
    const { lockedUntil: nextLockedUntil } = await recordFailure(
      viewer.userId,
      failureState?.failed_attempts ?? 0
    );

    return json(
      {
        ok: false,
        error: nextLockedUntil ? "admin_access_locked" : "invalid_passcode",
        remainingAttempts: Math.max(0, MAX_ADMIN_ACCESS_FAILURES - ((failureState?.failed_attempts ?? 0) + 1)),
        lockedUntil: nextLockedUntil
      },
      nextLockedUntil ? 423 : 401
    );
  }

  await resetFailureState(viewer.userId);

  const response = json({
    ok: true,
    next: nextPath
  });

  response.cookies.set(ADMIN_ACCESS_COOKIE, createAdminAccessCookieValue(viewer.userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS
  });

  return response;
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_ACCESS_COOKIE);
  return json({ ok: true });
}
