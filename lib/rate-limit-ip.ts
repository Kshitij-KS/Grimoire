/**
 * Reusable in-memory rate limiters for public/unauthenticated endpoints.
 *
 * This module generalizes the sliding-window Map design used by
 * `lib/middleware/auth-rate-limit.ts` into two configurable primitives:
 *
 *  - `checkIpRateLimit(key, ip, { windowMs, max })` — a per-IP sliding window,
 *    keyed by `"<key>:<ip>"`, so multiple endpoints can share the module with
 *    independent buckets.
 *  - `checkGlobalDailyCap(key, max)` — a process-level circuit breaker that
 *    counts every request under `key` for the current UTC day and rejects once
 *    the daily maximum is reached. The counter resets at UTC midnight.
 *
 * Caveat: like the auth limiter, the store lives in a single serverless isolate
 * and resets on cold start. It raises the cost of scripted abuse without a
 * shared store; a Redis/Upstash-backed store is a post-launch hardening option.
 *
 * Requirement 8.1: per-IP throttling using the middleware auth-rate-limit pattern.
 * Requirement 8.2: a hard daily global request cap as a circuit breaker.
 * Requirement 8.3: reject when either limit is exceeded.
 */

export interface IpRateLimitOptions {
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed per window. */
  max: number;
}

export interface IpRateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest tracked request exits the window (only when rejected). */
  retryAfter?: number;
}

export interface GlobalDailyCapResult {
  allowed: boolean;
}

/**
 * Per-IP sliding-window store: `"<key>:<ip>"` -> request timestamps (ms) in window.
 */
const ipStore = new Map<string, number[]>();

/**
 * Global daily counter store: `key` -> { day, count } where `day` is the UTC
 * day index the counter belongs to. The counter resets when the day changes.
 */
const globalStore = new Map<string, { day: number; count: number }>();

/** UTC day index (days since epoch) used to detect the UTC-midnight rollover. */
function utcDayIndex(now: number): number {
  return Math.floor(now / 86_400_000);
}

/**
 * Removes expired timestamps from every per-IP entry and drops empty entries,
 * bounding memory growth. Called on each check.
 */
function cleanupIpStore(now: number, windowMs: number): void {
  const windowStart = now - windowMs;
  for (const [storeKey, timestamps] of ipStore) {
    const valid = timestamps.filter((ts) => ts > windowStart);
    if (valid.length === 0) {
      ipStore.delete(storeKey);
    } else {
      ipStore.set(storeKey, valid);
    }
  }
}

/**
 * Checks whether the given IP is within the sliding-window rate limit for `key`.
 * When over the limit, returns `allowed: false` with a `retryAfter` in seconds.
 */
export function checkIpRateLimit(
  key: string,
  ip: string,
  opts: IpRateLimitOptions,
): IpRateLimitResult {
  const { windowMs, max } = opts;
  const now = Date.now();

  cleanupIpStore(now, windowMs);

  const storeKey = `${key}:${ip}`;
  const windowStart = now - windowMs;
  const timestamps = ipStore.get(storeKey) ?? [];
  const validTimestamps = timestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= max) {
    const oldestTimestamp = validTimestamps[0];
    const retryAfterMs = oldestTimestamp + windowMs - now;
    const retryAfter = Math.ceil(retryAfterMs / 1000);

    // Persist the filtered timestamps (no new request recorded).
    ipStore.set(storeKey, validTimestamps);

    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  // Under the limit: record this request.
  validTimestamps.push(now);
  ipStore.set(storeKey, validTimestamps);

  return { allowed: true };
}

/**
 * Increments and checks the process-level daily cap for `key`. Returns
 * `allowed: false` once `max` requests have been counted for the current UTC
 * day. The counter resets automatically at UTC midnight.
 */
export function checkGlobalDailyCap(key: string, max: number): GlobalDailyCapResult {
  const now = Date.now();
  const day = utcDayIndex(now);

  const entry = globalStore.get(key);
  if (!entry || entry.day !== day) {
    // First request of a new UTC day (or ever): reset the counter.
    globalStore.set(key, { day, count: 1 });
    return { allowed: max >= 1 };
  }

  if (entry.count >= max) {
    return { allowed: false };
  }

  entry.count += 1;
  globalStore.set(key, entry);
  return { allowed: true };
}

/**
 * Resets both in-memory stores. Exposed so tests can run deterministically.
 */
export function __resetRateLimitStores(): void {
  ipStore.clear();
  globalStore.clear();
}
