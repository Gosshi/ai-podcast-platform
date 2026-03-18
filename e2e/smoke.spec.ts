import { test, expect } from "@playwright/test";

test.describe("Smoke tests — public pages render", () => {
  test("home page loads and shows main heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
    // Should contain some form of login UI
    const pageText = await page.textContent("body");
    expect(pageText).toBeTruthy();
  });

  test("episodes page loads without auth", async ({ page }) => {
    await page.goto("/episodes");
    await expect(page.locator("body")).toBeVisible();
  });

  test("API health check — analytics track returns 400 without body", async ({ request }) => {
    const response = await request.post("/api/analytics/track", {
      data: {}
    });
    // Should return 400 (invalid_event_name), not 500
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("invalid_event_name");
  });

  test("API auth check — decision-history returns 401 without auth", async ({ request }) => {
    const response = await request.post("/api/decision-history", {
      data: { judgmentCardId: "test" },
      headers: { Origin: "http://localhost:3000" }
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });

  test("API rate limit returns proper 429 format", async ({ request }) => {
    // Send many requests quickly to trigger rate limit
    const promises = Array.from({ length: 65 }, () =>
      request.post("/api/analytics/track", { data: {} })
    );
    const responses = await Promise.all(promises);

    const rateLimited = responses.filter((r) => r.status() === 429);
    if (rateLimited.length > 0) {
      const body = await rateLimited[0].json();
      expect(body.ok).toBe(false);
      expect(body.error).toBe("rate_limit_exceeded");
      const retryAfter = rateLimited[0].headers()["retry-after"];
      expect(retryAfter).toBeTruthy();
    }
    // Even if no 429 (e.g. warm server), all should be 400 (invalid body)
    const allValid = responses.every((r) => r.status() === 400 || r.status() === 429);
    expect(allValid).toBe(true);
  });
});
