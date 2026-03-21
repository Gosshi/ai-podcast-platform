/**
 * In-memory sliding-window rate limiter for API routes.
 *
 * Each limiter tracks requests per key (typically IP or userId)
 * within a configurable time window. When the limit is exceeded,
 * callers receive a structured result to return a 429 response.
 *
 * Limitations:
 * - State is per-process; resets on deploy/restart.
 * - Not shared across multiple server instances.
 *   → Upgrade to Redis (@upstash/ratelimit) when scaling horizontally.
 */

type RateLimitEntry = {
  timestamps: number[];
};

type RateLimitConfig = {
  /** Max requests allowed within the window. */
  maxRequests: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterMs: number };

const stores = new Map<string, Map<string, RateLimitEntry>>();

/** Interval for garbage-collecting expired entries (5 minutes). */
const GC_INTERVAL_MS = 5 * 60 * 1000;
let gcTimer: ReturnType<typeof setInterval> | null = null;

const runGarbageCollection = () => {
  const now = Date.now();
  for (const [storeName, store] of stores) {
    for (const [key, entry] of store) {
      // Remove timestamps older than any conceivable window (10 min max)
      entry.timestamps = entry.timestamps.filter((t) => now - t < 10 * 60 * 1000);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      stores.delete(storeName);
    }
  }
};

const ensureGc = () => {
  if (gcTimer) return;
  gcTimer = setInterval(runGarbageCollection, GC_INTERVAL_MS);
  // Allow Node process to exit even if timer is running
  if (typeof gcTimer === "object" && "unref" in gcTimer) {
    gcTimer.unref();
  }
};

/**
 * Create a named rate limiter with the given config.
 * Each limiter maintains its own independent store.
 */
export const createRateLimiter = (name: string, config: RateLimitConfig) => {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;
  ensureGc();

  return {
    /**
     * Check if a request from `key` is allowed.
     * @param key — typically IP address, userId, or a combination
     */
    check: (key: string): RateLimitResult => {
      const now = Date.now();
      const windowStart = now - config.windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

      if (entry.timestamps.length >= config.maxRequests) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = oldestInWindow + config.windowMs - now;
        return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 1000) };
      }

      entry.timestamps.push(now);
      return { allowed: true, remaining: config.maxRequests - entry.timestamps.length };
    }
  };
};

/**
 * Extract a rate-limit key from a Request.
 * Uses X-Forwarded-For (proxy), then falls back to a fixed key.
 */
export const extractRateLimitKey = (request: Request, userId?: string | null): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return userId ? `${userId}:${ip}` : ip;
};

// ─── Pre-configured limiters for different route categories ───

/** General user-facing mutations: 30 req/min */
export const generalLimiter = createRateLimiter("general", {
  maxRequests: 30,
  windowMs: 60_000
});

/** Expensive AI/external calls: 10 req/min */
export const expensiveLimiter = createRateLimiter("expensive", {
  maxRequests: 10,
  windowMs: 60_000
});

/** Payment/checkout operations: 5 req/min */
export const paymentLimiter = createRateLimiter("payment", {
  maxRequests: 5,
  windowMs: 60_000
});

/** Admin authentication and control operations: 10 req / 10 min */
export const adminLimiter = createRateLimiter("admin", {
  maxRequests: 10,
  windowMs: 10 * 60_000
});

/** Analytics tracking: 60 req/min (high volume, lightweight) */
export const analyticsLimiter = createRateLimiter("analytics", {
  maxRequests: 60,
  windowMs: 60_000
});
