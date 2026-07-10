// Feature: ship-plan-v1, Property 2: IP and global rate limits never allow more than their maximum
//
// Exercises the pure limiter logic in `lib/rate-limit-ip.ts`:
//   - For any sequence of requests from a single IP within one window, the
//     number reported as allowed never exceeds the configured per-IP maximum.
//   - Once the global daily cap has been reached, every subsequent request is
//     rejected.
// The reset helper is called between runs so each property iteration starts
// from a clean, deterministic store.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import {
  checkIpRateLimit,
  checkGlobalDailyCap,
  __resetRateLimitStores,
} from "@/lib/rate-limit-ip";

describe("Feature: ship-plan-v1, Property 2: IP and global rate limits never allow more than their maximum", () => {
  beforeEach(() => {
    // Freeze time so every request in a run lands inside the same window; the
    // sliding-window logic must gate on count alone under these conditions.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    __resetRateLimitStores();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never allows more than `max` per-IP requests within a single window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // max
        fc.integer({ min: 1, max: 60 }), // number of requests
        (max, requests) => {
          __resetRateLimitStores();

          let allowedCount = 0;
          for (let i = 0; i < requests; i++) {
            const result = checkIpRateLimit("demo_chat", "203.0.113.7", {
              windowMs: 60_000,
              max,
            });
            if (result.allowed) allowedCount++;
          }

          // Invariant: allowed count is capped by `max`, and equals min(requests, max).
          expect(allowedCount).toBeLessThanOrEqual(max);
          expect(allowedCount).toBe(Math.min(requests, max));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("tracks distinct IPs independently, each capped by `max`", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // max
        fc.array(fc.constantFrom("a", "b", "c", "d"), { minLength: 0, maxLength: 40 }),
        (max, ipSequence) => {
          __resetRateLimitStores();

          const allowedPerIp = new Map<string, number>();
          for (const ip of ipSequence) {
            const result = checkIpRateLimit("demo_chat", ip, {
              windowMs: 60_000,
              max,
            });
            if (result.allowed) {
              allowedPerIp.set(ip, (allowedPerIp.get(ip) ?? 0) + 1);
            }
          }

          for (const count of allowedPerIp.values()) {
            expect(count).toBeLessThanOrEqual(max);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("rejects every request once the global daily cap is reached", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // cap
        fc.integer({ min: 0, max: 40 }), // extra requests beyond the cap
        (cap, extra) => {
          __resetRateLimitStores();

          const totalRequests = cap + extra;
          let allowedCount = 0;
          let sawRejection = false;
          for (let i = 0; i < totalRequests; i++) {
            const result = checkGlobalDailyCap("demo_chat", cap);
            if (result.allowed) {
              allowedCount++;
              // Nothing may be allowed after a rejection has been observed.
              expect(sawRejection).toBe(false);
            } else {
              sawRejection = true;
            }
          }

          // Never allow more than the cap; allowed equals min(total, cap).
          expect(allowedCount).toBeLessThanOrEqual(cap);
          expect(allowedCount).toBe(Math.min(totalRequests, cap));
        },
      ),
      { numRuns: 200 },
    );
  });
});
