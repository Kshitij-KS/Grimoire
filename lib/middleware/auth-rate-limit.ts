/**
 * IP-based sliding window rate limiter for auth endpoints.
 * Uses an in-memory Map to track request timestamps per IP.
 *
 * Requirement 4.2: Reject /api/auth/* requests exceeding 10 req/60s per IP
 * Requirement 4.5: Return error body indicating rate limit exceeded
 */

const WINDOW_MS = 60_000; // 60 seconds
const MAX_REQUESTS = 10;

/**
 * In-memory store: IP -> array of request timestamps (ms) within the window.
 * Acceptable for edge middleware where isolates share memory for ~5 minutes.
 */
const store = new Map<string, number[]>();

/**
 * Removes expired timestamps from all entries and deletes empty entries.
 * Called on each rate-limit check to prevent memory leaks.
 */
function cleanup(now: number): void {
  const windowStart = now - WINDOW_MS;
  for (const [ip, timestamps] of store) {
    const valid = timestamps.filter((ts) => ts > windowStart);
    if (valid.length === 0) {
      store.delete(ip);
    } else {
      store.set(ip, valid);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until oldest request exits the window
}

/**
 * Checks whether the given IP is within the rate limit for auth endpoints.
 * If over the limit, returns `allowed: false` with a `retryAfter` value in seconds.
 */
export function checkAuthRateLimit(ip: string): RateLimitResult {
  const now = Date.now();

  // TTL cleanup: remove expired entries to prevent memory leaks
  cleanup(now);

  const windowStart = now - WINDOW_MS;
  const timestamps = store.get(ip) ?? [];

  // Filter to only timestamps within the current window
  const validTimestamps = timestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= MAX_REQUESTS) {
    // Calculate Retry-After: seconds until the oldest tracked request exits the window
    const oldestTimestamp = validTimestamps[0];
    const retryAfterMs = oldestTimestamp + WINDOW_MS - now;
    const retryAfter = Math.ceil(retryAfterMs / 1000);

    // Update the store with filtered timestamps (no new entry added)
    store.set(ip, validTimestamps);

    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  // Under the limit: record this request
  validTimestamps.push(now);
  store.set(ip, validTimestamps);

  return { allowed: true };
}

/**
 * Extracts the client IP from a request.
 * Checks x-forwarded-for header first (common behind proxies/Vercel),
 * then falls back to request.ip if available.
 */
export function getClientIp(request: Request & { ip?: string }): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; use the first (client IP)
    return forwarded.split(",")[0].trim();
  }
  return (request as { ip?: string }).ip ?? "unknown";
}

/**
 * Resets the rate limit store. Useful for testing.
 */
export function resetRateLimitStore(): void {
  store.clear();
}
