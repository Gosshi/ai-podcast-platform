/**
 * CSRF protection via Origin header verification.
 *
 * All state-changing API routes (POST / PUT / PATCH / DELETE) should call
 * `verifyCsrfOrigin(request)` before processing the request body.
 *
 * In production the Origin header must match the deployment URL.
 * In development any localhost / 127.0.0.1 origin is accepted.
 */

const ALLOWED_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

const resolveAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();

  // VERCEL_URL is set automatically on Vercel deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    origins.add(`https://${vercelUrl}`);
  }

  // Explicit override via environment variable
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (siteUrl) {
    origins.add(siteUrl.replace(/\/$/, ""));
  }

  return origins;
};

export type CsrfResult =
  | { ok: true }
  | { ok: false; error: string };

export const verifyCsrfOrigin = (request: Request): CsrfResult => {
  const origin = request.headers.get("origin");

  // If no Origin header, check Referer as fallback (some browsers omit Origin on same-origin)
  if (!origin) {
    const referer = request.headers.get("referer");
    if (!referer) {
      // Allow requests with no Origin/Referer — these are typically same-origin
      // fetch() calls or server-to-server calls. Browsers always send Origin on
      // cross-origin POST requests.
      return { ok: true };
    }
    try {
      const refUrl = new URL(referer);
      const refOrigin = refUrl.origin;
      return verifyOriginValue(refOrigin);
    } catch {
      return { ok: false, error: "invalid_referer" };
    }
  }

  return verifyOriginValue(origin);
};

const verifyOriginValue = (origin: string): CsrfResult => {
  // Development: allow localhost
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      if (ALLOWED_DEV_HOSTS.has(url.hostname)) {
        return { ok: true };
      }
    } catch {
      // fall through to production check
    }
  }

  const allowed = resolveAllowedOrigins();

  // If no allowed origins configured, skip check (development without VERCEL_URL)
  if (allowed.size === 0 && process.env.NODE_ENV !== "production") {
    return { ok: true };
  }

  if (allowed.has(origin)) {
    return { ok: true };
  }

  return { ok: false, error: "csrf_origin_mismatch" };
};
