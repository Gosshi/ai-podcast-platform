/**
 * Authenticated E2E tests — verify protected pages and API routes
 * when a user session cookie is present.
 *
 * Strategy:
 *   The proxy (proxy.ts) only checks for cookie EXISTENCE — it does
 *   not validate the JWT. So with a fake cookie:
 *   - Proxy allows access (no redirect to /login)
 *   - Server Components call getViewerFromCookies() which validates
 *     the JWT via Supabase, and will get null/error
 *
 *   This lets us test the proxy layer independently from the
 *   Supabase auth layer.
 *
 *   Note: Some pages (e.g. /admin/analytics) perform additional
 *   server-side auth checks that may redirect even when the proxy
 *   allows access. This is the defense-in-depth pattern working
 *   as intended.
 */
import { test, expect } from "@playwright/test";

const FAKE_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MTAwMDAwMDB9.fake";

const injectAuthCookie = async (context: import("@playwright/test").BrowserContext) => {
  await context.addCookies([
    {
      name: "app_access_token",
      value: FAKE_ACCESS_TOKEN,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
};

// ─── Proxy bypass: cookie present → no redirect to /login ───────

test.describe("Proxy allows access with auth cookie", () => {
  test.beforeEach(async ({ context }) => {
    await injectAuthCookie(context);
  });

  test("/decisions does NOT redirect to /login when cookie is present", async ({ page }) => {
    await page.goto("/decisions");
    await page.waitForLoadState("domcontentloaded");
    // Proxy sees the cookie → allows through (no /login redirect)
    expect(page.url()).not.toContain("/login");
  });

  test("/history does NOT redirect to /login when cookie is present", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).not.toContain("/login");
  });

  test("/account does NOT redirect to /login when cookie is present", async ({ page }) => {
    await page.goto("/account");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).not.toContain("/login");
  });

  test("/decisions/some-id does NOT redirect to /login when cookie is present", async ({ page }) => {
    await page.goto("/decisions/some-id");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).not.toContain("/login");
  });
});

// ─── Defense in depth: server-side auth on admin pages ──────────

test.describe("Admin pages enforce server-side auth beyond proxy", () => {
  test.beforeEach(async ({ context }) => {
    await injectAuthCookie(context);
  });

  test("/admin/analytics redirects to /login despite cookie (invalid JWT)", async ({ page }) => {
    // Proxy allows through (cookie exists), but Server Component
    // validates the JWT via Supabase → invalid → redirects to /login
    await page.goto("/admin/analytics");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/login");
  });
});

// ─── Contrast: without cookie, proxy redirects ──────────────────

test.describe("Proxy redirects without cookie (control group)", () => {
  test("/decisions redirects to /login without cookie", async ({ page }) => {
    // Ensure no cookies are set — fresh context per test
    await page.context().clearCookies();
    await page.goto("/decisions");
    expect(page.url()).toContain("/login");
  });

  test("/account redirects to /login without cookie", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/account");
    expect(page.url()).toContain("/login");
  });
});

// ─── API routes with cookie but invalid JWT ─────────────────────

test.describe("API routes validate JWT even with cookie present", () => {
  test.beforeEach(async ({ context }) => {
    await injectAuthCookie(context);
  });

  test("POST /api/decision-history returns 401 with invalid JWT", async ({ request }) => {
    const res = await request.post("/api/decision-history", {
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json"
      },
      data: { judgmentCardId: "test-id" }
    });
    // Server validates JWT via Supabase → invalid → 401
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });

  test("POST /api/watchlist returns 401 with invalid JWT", async ({ request }) => {
    const res = await request.post("/api/watchlist", {
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json"
      },
      data: { judgmentCardId: "test-id", status: "saved" }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });

  test("POST /api/generate-card returns 401 with invalid JWT", async ({ request }) => {
    const res = await request.post("/api/generate-card", {
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json"
      },
      data: { episodeId: "test-ep" }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });
});

// ─── Public pages still work with auth cookie ───────────────────

test.describe("Public pages still accessible with auth cookie", () => {
  test.beforeEach(async ({ context }) => {
    await injectAuthCookie(context);
  });

  test("/ renders normally with cookie", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("/episodes renders normally with cookie", async ({ page }) => {
    await page.goto("/episodes");
    await expect(page.locator("body")).toBeVisible();
  });
});
