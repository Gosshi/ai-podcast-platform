import { test, expect } from "@playwright/test";

test.describe("Auth guard (proxy)", () => {
  test("redirects /decisions to /login when not authenticated", async ({ page }) => {
    const response = await page.goto("/decisions");
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("next=%2Fdecisions");
  });

  test("redirects /history to /login when not authenticated", async ({ page }) => {
    await page.goto("/history");
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("next=%2Fhistory");
  });

  test("redirects /account to /login when not authenticated", async ({ page }) => {
    await page.goto("/account");
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("next=%2Faccount");
  });

  test("redirects /admin/analytics to /login when not authenticated", async ({ page }) => {
    await page.goto("/admin/analytics");
    expect(page.url()).toContain("/login");
  });

  test("redirects /decisions/some-id to /login when not authenticated", async ({ page }) => {
    await page.goto("/decisions/some-id");
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("next=%2Fdecisions%2Fsome-id");
  });

  test("does NOT redirect / (home) when not authenticated", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
  });

  test("does NOT redirect /episodes when not authenticated", async ({ page }) => {
    await page.goto("/episodes");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
  });

  test("does NOT redirect /login when not authenticated", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/login");
    expect(page.url()).not.toContain("next=");
  });
});
