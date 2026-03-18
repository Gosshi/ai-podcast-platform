/**
 * Timing-safe CRON secret verification.
 *
 * Uses constant-time comparison to prevent timing attacks on the shared secret.
 */
import { timingSafeEqual } from "node:crypto";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export const verifyCronSecret = (request: Request): CronAuthResult => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return { ok: false, error: "cron_secret_not_configured", status: 503 };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  // Constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const expected = encoder.encode(cronSecret);
  const received = encoder.encode(token);

  if (expected.length !== received.length) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  if (!timingSafeEqual(expected, received)) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  return { ok: true };
};
