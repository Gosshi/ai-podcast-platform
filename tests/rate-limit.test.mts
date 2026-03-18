/**
 * Unit tests for the sliding-window rate limiter.
 *
 * Uses node:test runner (consistent with the rest of the test suite).
 * Tests cover: basic allow/deny, window expiry, boundary conditions,
 * independent stores, extractRateLimitKey, and GC behaviour.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createRateLimiter,
  extractRateLimitKey
} from "../app/lib/rateLimit.ts";

// ---------------------------------------------------------------------------
// createRateLimiter — basic behaviour
// ---------------------------------------------------------------------------

test("allows requests within the limit", () => {
  const limiter = createRateLimiter("test-basic-allow", {
    maxRequests: 3,
    windowMs: 60_000
  });

  const r1 = limiter.check("user-1");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = limiter.check("user-1");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = limiter.check("user-1");
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);
});

test("denies requests that exceed the limit", () => {
  const limiter = createRateLimiter("test-basic-deny", {
    maxRequests: 2,
    windowMs: 60_000
  });

  limiter.check("user-1");
  limiter.check("user-1");

  const r3 = limiter.check("user-1");
  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
  assert.ok("retryAfterMs" in r3);
  assert.ok(r3.retryAfterMs! >= 1000, "retryAfterMs should be at least 1 000 ms");
});

test("retryAfterMs is capped at a minimum of 1 000 ms", () => {
  const limiter = createRateLimiter("test-retry-floor", {
    maxRequests: 1,
    windowMs: 500 // very short window
  });

  limiter.check("user-1");
  const denied = limiter.check("user-1");
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterMs! >= 1000);
});

// ---------------------------------------------------------------------------
// Window expiry
// ---------------------------------------------------------------------------

test("allows requests again after the window expires", async () => {
  const limiter = createRateLimiter("test-window-expiry", {
    maxRequests: 1,
    windowMs: 50 // 50 ms window for fast test
  });

  const first = limiter.check("user-1");
  assert.equal(first.allowed, true);

  const denied = limiter.check("user-1");
  assert.equal(denied.allowed, false);

  // Wait for the window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  const afterExpiry = limiter.check("user-1");
  assert.equal(afterExpiry.allowed, true, "should allow after window expires");
});

// ---------------------------------------------------------------------------
// Per-key isolation
// ---------------------------------------------------------------------------

test("tracks requests independently per key", () => {
  const limiter = createRateLimiter("test-per-key", {
    maxRequests: 1,
    windowMs: 60_000
  });

  const a1 = limiter.check("user-a");
  assert.equal(a1.allowed, true);

  const b1 = limiter.check("user-b");
  assert.equal(b1.allowed, true, "different key should have its own counter");

  const a2 = limiter.check("user-a");
  assert.equal(a2.allowed, false, "user-a should be rate limited");

  const b2 = limiter.check("user-b");
  assert.equal(b2.allowed, false, "user-b should also be rate limited now");
});

// ---------------------------------------------------------------------------
// Independent named stores
// ---------------------------------------------------------------------------

test("different limiter names maintain independent stores", () => {
  const limiterA = createRateLimiter("test-store-a", {
    maxRequests: 1,
    windowMs: 60_000
  });
  const limiterB = createRateLimiter("test-store-b", {
    maxRequests: 1,
    windowMs: 60_000
  });

  limiterA.check("shared-key");
  const fromA = limiterA.check("shared-key");
  assert.equal(fromA.allowed, false, "limiterA should be exhausted");

  const fromB = limiterB.check("shared-key");
  assert.equal(fromB.allowed, true, "limiterB should be independent");
});

// ---------------------------------------------------------------------------
// Remaining count accuracy
// ---------------------------------------------------------------------------

test("remaining count decrements correctly to zero", () => {
  const limiter = createRateLimiter("test-remaining", {
    maxRequests: 4,
    windowMs: 60_000
  });

  const results = Array.from({ length: 4 }, () => limiter.check("user-1"));
  assert.deepEqual(
    results.map((r) => r.remaining),
    [3, 2, 1, 0]
  );

  // Fifth request should be denied with remaining: 0
  const denied = limiter.check("user-1");
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
});

// ---------------------------------------------------------------------------
// extractRateLimitKey
// ---------------------------------------------------------------------------

test("extractRateLimitKey uses x-forwarded-for when present", () => {
  const req = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.1" }
  });
  const key = extractRateLimitKey(req);
  assert.equal(key, "203.0.113.42");
});

test("extractRateLimitKey falls back to 'unknown' without forwarded header", () => {
  const req = new Request("http://localhost/api/test");
  const key = extractRateLimitKey(req);
  assert.equal(key, "unknown");
});

test("extractRateLimitKey prepends userId when provided", () => {
  const req = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": "1.2.3.4" }
  });
  const key = extractRateLimitKey(req, "user-abc");
  assert.equal(key, "user-abc:1.2.3.4");
});

test("extractRateLimitKey with userId but no forwarded header", () => {
  const req = new Request("http://localhost/api/test");
  const key = extractRateLimitKey(req, "user-abc");
  assert.equal(key, "user-abc:unknown");
});

test("extractRateLimitKey ignores null userId", () => {
  const req = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": "10.0.0.1" }
  });
  const key = extractRateLimitKey(req, null);
  assert.equal(key, "10.0.0.1");
});

// ---------------------------------------------------------------------------
// Edge: zero-request limiter
// ---------------------------------------------------------------------------

test("limiter with maxRequests: 0 denies all requests", () => {
  const limiter = createRateLimiter("test-zero", {
    maxRequests: 0,
    windowMs: 60_000
  });
  const result = limiter.check("user-1");
  assert.equal(result.allowed, false);
});
