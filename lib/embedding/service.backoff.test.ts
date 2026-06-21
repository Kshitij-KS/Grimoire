// Feature: free-chunking-embedding-api, Property 6: Backoff is exponential,
// starts at 1s, doubles, and is capped at 60s.
//
// For any attempt index n >= 1, the backoff delay equals
// min(2^(n-1) * 1000, 60000) milliseconds; the sequence is non-decreasing in n
// and never exceeds 60000 ms.
//
// Validates: Requirements 4.2

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { backoffDelayMs } from "./service";
import { BACKOFF_CAP_MS, BACKOFF_START_MS } from "./constants";

describe("backoffDelayMs (Property 6: exponential backoff schedule)", () => {
  it("attempt 1 starts at 1000 ms", () => {
    expect(backoffDelayMs(1)).toBe(BACKOFF_START_MS);
    expect(backoffDelayMs(1)).toBe(1000);
  });

  it("follows the documented 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped) sequence", () => {
    expect(backoffDelayMs(1)).toBe(1000);
    expect(backoffDelayMs(2)).toBe(2000);
    expect(backoffDelayMs(3)).toBe(4000);
    expect(backoffDelayMs(4)).toBe(8000);
    expect(backoffDelayMs(5)).toBe(16000);
    expect(backoffDelayMs(6)).toBe(32000);
    // 2^6 * 1000 = 64000 -> capped at 60000
    expect(backoffDelayMs(7)).toBe(60000);
  });

  // Property 6: the full schedule holds for any attempt index n >= 1.
  it("equals min(2^(n-1) * 1000, 60000), is capped, and is non-decreasing", () => {
    fc.assert(
      fc.property(
        // Attempt indices are 1-based. Bound the range to keep 2^(n-1) finite
        // while still exercising both the exponential and capped regimes.
        fc.integer({ min: 1, max: 1000 }),
        (attempt) => {
          const delay = backoffDelayMs(attempt);
          const expected = Math.min(
            Math.pow(2, attempt - 1) * BACKOFF_START_MS,
            BACKOFF_CAP_MS
          );

          // Exact formula match.
          expect(delay).toBe(expected);
          // Never exceeds the 60s cap.
          expect(delay).toBeLessThanOrEqual(BACKOFF_CAP_MS);
          // Always at least the 1s start.
          expect(delay).toBeGreaterThanOrEqual(BACKOFF_START_MS);
          // Non-decreasing: the previous attempt's delay is <= this one's.
          if (attempt > 1) {
            expect(backoffDelayMs(attempt - 1)).toBeLessThanOrEqual(delay);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
