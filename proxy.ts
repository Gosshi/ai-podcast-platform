import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware — Centralized authentication gate.
 *
 * Intercepts navigation requests and redirects unauthenticated users
 * to /login for protected routes. This is a lightweight cookie-presence
 * check; full token validation still happens in Server Components via
 * getViewerFromCookies() (defense in depth).
 *
 * Route categories:
 *   Protected   — /decisions, /history, /account, /onboarding, /admin/*
 *   Public      — /, /login, /auth/callback, /episodes, /dev/*
 *   API / Asset — Skipped (handled by route-level auth or static serving)
 */

const ACCESS_TOKEN_COOKIE = "app_access_token";

/**
 * Path prefixes that require authentication.
 * Matched with startsWith — e.g. "/decisions" matches "/decisions/abc".
 */
const PROTECTED_PATH_PREFIXES = [
  "/decisions",
  "/history",
  "/account",
  "/onboarding",
  "/admin"
];

/**
 * Path prefixes that the middleware should skip entirely
 * (API routes, static assets, Next.js internals).
 */
const SKIP_PREFIXES = [
  "/api/",
  "/_next/",
  "/favicon"
];

const shouldSkip = (pathname: string): boolean => {
  return SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

const isProtectedPath = (pathname: string): boolean => {
  return PROTECTED_PATH_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static assets, and Next.js internals
  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  // Only gate protected paths; public pages pass through
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
