import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/app/lib/apiResponse";
import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { adminLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS,
  ADMIN_ACCESS_OTP_TTL_MINUTES,
  createAdminAccessCookieValue,
  generateAdminAccessCode,
  hashAdminAccessCode,
  isAdminAccessGateEnabled,
  normalizeAdminNextPath,
  verifyAdminAccessCode
} from "@/app/lib/adminAccess";
import { resolveAdminEmails } from "@/app/lib/adminGuard";
import { sendEmail } from "@/app/lib/email";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

const MAX_ADMIN_ACCESS_FAILURES = 10;
const LOCKOUT_MINUTES = 30;
const CODE_RESEND_COOLDOWN_SECONDS = 60;

type AdminAccessRequest = {
  action?: unknown;
  code?: unknown;
  next?: unknown;
};

type AdminAccessAttemptRow = {
  user_id: string;
  failed_attempts: number;
  locked_until: string | null;
};

type AdminAccessChallengeRow = {
  user_id: string;
  code_hash: string | null;
  expires_at: string | null;
  sent_at: string | null;
  consumed_at: string | null;
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

const readChallenge = async (userId: string): Promise<AdminAccessChallengeRow | null> => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_access_challenges")
    .select("user_id, code_hash, expires_at, sent_at, consumed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AdminAccessChallengeRow | null) ?? null;
};

const upsertChallenge = async (params: {
  userId: string;
  codeHash: string;
  expiresAt: string;
  sentAt: string;
}): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("admin_access_challenges").upsert(
    {
      user_id: params.userId,
      code_hash: params.codeHash,
      expires_at: params.expiresAt,
      sent_at: params.sentAt,
      consumed_at: null
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
};

const consumeChallenge = async (userId: string): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("admin_access_challenges")
    .update({
      code_hash: null,
      consumed_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
};

const deleteChallenge = async (userId: string): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("admin_access_challenges").delete().eq("user_id", userId);

  if (error) {
    throw error;
  }
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

const isFutureTimestamp = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed > Date.now();
};

const formatCooldownSeconds = (sentAt: string | null): number => {
  if (!sentAt) {
    return 0;
  }

  const sentAtMs = new Date(sentAt).getTime();
  if (!Number.isFinite(sentAtMs)) {
    return 0;
  }

  const remaining = CODE_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - sentAtMs) / 1000);
  return remaining > 0 ? remaining : 0;
};

const sendAdminAccessCodeEmail = async (params: {
  to: string;
  code: string;
  nextPath: string;
}) => {
  const result = await sendEmail({
    to: params.to,
    subject: "【SignalMove】管理者アクセス確認コード",
    html: `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px;background:#081427;color:#f8fafc;font-size:20px;font-weight:800;">SignalMove Admin</td></tr>
        <tr><td style="padding:28px 24px;color:#0f172a;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#0369a1;letter-spacing:0.08em;text-transform:uppercase;">Admin Access</p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.4;">管理者アクセス確認コード</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
            管理画面へ進むための確認コードです。10 分以内に入力してください。
          </p>
          <p style="margin:0 0 20px;padding:18px;border-radius:14px;background:#0f172a;color:#f8fafc;font-size:32px;font-weight:800;letter-spacing:0.16em;text-align:center;">
            ${params.code}
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
            対象画面: ${params.nextPath}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: [
      "管理者アクセス確認コード",
      "",
      "管理画面へ進むための確認コードです。10 分以内に入力してください。",
      "",
      `確認コード: ${params.code}`,
      `対象画面: ${params.nextPath}`
    ].join("\n")
  });

  return result;
};

export async function POST(request: Request) {
  if (!isAdminAccessGateEnabled()) {
    return json({ ok: false, error: "admin_access_not_configured" }, 503);
  }

  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return json({ ok: false, error: csrf.error }, 403);
  }

  const rateLimitResponse = checkRateLimit(adminLimiter, extractRateLimitKey(request));
  if (rateLimitResponse) {
    return rateLimitResponse;
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
  const action = body.action === "request_code" || body.action === "verify_code" ? body.action : null;
  const code = typeof body.code === "string" ? body.code : "";
  const nextPath = normalizeAdminNextPath(typeof body.next === "string" ? body.next : null);

  if (!action) {
    return json({ ok: false, error: "invalid_action" }, 400);
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

  if (action === "request_code") {
    const existingChallenge = await readChallenge(viewer.userId);
    const cooldownSeconds = formatCooldownSeconds(existingChallenge?.sent_at ?? null);
    if (cooldownSeconds > 0) {
      return json(
        {
          ok: false,
          error: "code_resend_cooldown",
          retryAfterSeconds: cooldownSeconds
        },
        429
      );
    }

    const nextCode = generateAdminAccessCode();
    const sentAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ADMIN_ACCESS_OTP_TTL_MINUTES * 60 * 1000).toISOString();

    await upsertChallenge({
      userId: viewer.userId,
      codeHash: hashAdminAccessCode(viewer.userId, nextCode),
      expiresAt,
      sentAt
    });

    const emailResult = await sendAdminAccessCodeEmail({
      to: viewer.email!,
      code: nextCode,
      nextPath
    });

    if (!emailResult.ok) {
      await deleteChallenge(viewer.userId).catch(() => undefined);
      return json(
        {
          ok: false,
          error: "code_send_failed",
          detail: emailResult.error ?? null
        },
        503
      );
    }

    return json({
      ok: true,
      sent: true,
      expiresAt
    });
  }

  if (!code.trim()) {
    return json({ ok: false, error: "code_required" }, 400);
  }

  const challenge = await readChallenge(viewer.userId);
  if (!challenge?.code_hash || challenge.consumed_at || !isFutureTimestamp(challenge.expires_at)) {
    return json({ ok: false, error: "code_expired" }, 410);
  }

  if (!verifyAdminAccessCode(viewer.userId, code, challenge.code_hash)) {
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

  await consumeChallenge(viewer.userId);
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
