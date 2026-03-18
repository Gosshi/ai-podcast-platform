/**
 * Shared helpers for API route handlers.
 * Consolidates jsonResponse / toNonEmptyString / getRequiredEnv
 * that were previously duplicated across 17+ route files.
 */

export const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

export const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

/**
 * Check a rate limiter and return a 429 response if the limit is exceeded.
 * Returns null if the request is allowed.
 */
export const checkRateLimit = (
  limiter: { check: (key: string) => { allowed: boolean; remaining: number; retryAfterMs?: number } },
  key: string
): Response | null => {
  const result = limiter.check(key);
  if (!result.allowed) {
    return new Response(
      JSON.stringify({ ok: false, error: "rate_limit_exceeded" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.retryAfterMs ?? 60_000) / 1000))
        }
      }
    );
  }
  return null;
};
