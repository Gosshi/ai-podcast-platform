import assert from "node:assert/strict";
import test from "node:test";

process.env.ADMIN_ACCESS_SECRET = "test-admin-secret";

const adminAccess = await import("../app/lib/adminAccessToken.ts");

test("create and verify admin access cookie for matching user", () => {
  const value = adminAccess.createAdminAccessCookieValue(
    "11111111-1111-4111-8111-111111111111",
    process.env.ADMIN_ACCESS_SECRET!,
    1_700_000_000_000
  );

  const ok = adminAccess.verifyAdminAccessCookieValue(
    value,
    "11111111-1111-4111-8111-111111111111",
    process.env.ADMIN_ACCESS_SECRET!,
    1_700_000_000_000 + 1_000
  );

  assert.equal(ok, true);
});

test("admin access cookie rejects different user", () => {
  const value = adminAccess.createAdminAccessCookieValue(
    "11111111-1111-4111-8111-111111111111",
    process.env.ADMIN_ACCESS_SECRET!,
    1_700_000_000_000
  );

  const ok = adminAccess.verifyAdminAccessCookieValue(
    value,
    "22222222-2222-4222-8222-222222222222",
    process.env.ADMIN_ACCESS_SECRET!,
    1_700_000_000_000 + 1_000
  );

  assert.equal(ok, false);
});

test("admin access cookie rejects expired token", () => {
  const value = adminAccess.createAdminAccessCookieValue(
    "11111111-1111-4111-8111-111111111111",
    process.env.ADMIN_ACCESS_SECRET!,
    1_700_000_000_000
  );

  const ok = adminAccess.verifyAdminAccessCookieValue(
    value,
    "11111111-1111-4111-8111-111111111111",
    process.env.ADMIN_ACCESS_SECRET!,
    1_700_000_000_000 + adminAccess.ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS * 1000 + 1
  );

  assert.equal(ok, false);
});

test("admin access code uses exact hash comparison", () => {
  const hash = adminAccess.hashAdminAccessCode(
    "11111111-1111-4111-8111-111111111111",
    "123456",
    process.env.ADMIN_ACCESS_SECRET!
  );

  assert.equal(
    adminAccess.verifyAdminAccessCode(
      "11111111-1111-4111-8111-111111111111",
      "123456",
      hash,
      process.env.ADMIN_ACCESS_SECRET!
    ),
    true
  );
  assert.equal(
    adminAccess.verifyAdminAccessCode(
      "11111111-1111-4111-8111-111111111111",
      "123450",
      hash,
      process.env.ADMIN_ACCESS_SECRET!
    ),
    false
  );
});

test("generated admin code is always six digits", () => {
  const code = adminAccess.generateAdminAccessCode();
  assert.equal(/^\d{6}$/.test(code), true);
});

test("normalizeAdminNextPath only allows admin paths", () => {
  assert.equal(adminAccess.normalizeAdminNextPath("/admin/trends"), "/admin/trends");
  assert.equal(adminAccess.normalizeAdminNextPath("/admin/job-runs"), "/admin/job-runs");
  assert.equal(adminAccess.normalizeAdminNextPath("/decisions"), "/admin/trends");
  assert.equal(adminAccess.normalizeAdminNextPath("https://example.com/admin"), "/admin/trends");
});
