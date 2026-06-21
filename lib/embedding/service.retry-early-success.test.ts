// Feature: free-chunking-embedding-api, Property 8: A retry that succeeds
// returns the vector and consumes no further attempts.
//
// For any k in [1, 6], when a provider fails with a retryable error on the
// first k-1 attempts and succeeds on attempt k, the Embedding_Service invokes
// the provider exactly k times, returns a 768-element vector, and makes no
// further attempts. Here k is parameterized as `failuresBeforeSuccess` in
// [0, 5] (the number of retryable failures), so the total invocation count is
// failuresBeforeSuccess + 1, in [1, 6] (initial request + up to 5 retries).
//
// Validates: Requirements 4.4, 4.5

import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { callWithRetry } from "./service";
import { REQUIRED_DIMENSION } from "./constants";
import type { EmbeddingProvider } from "./provider";

/** Build a well-formed success vector of exactly the required dimension. */
function makeVector(): number[] {
  return Array.from({ length: REQUIRED_DIMENSION }, () => 0.1);
}

/**
 * A retryable rate-limit error (HTTP 429). `callWithRetry` classifies this as
 * `rate-limit`, which is retryable (not terminal), so the loop keeps trying
 * until the provider succeeds or attempts are exhausted.
 */
function makeRateLimitError(): Error {
  return Object.assign(new Error("rate limit exceeded (429)"), { status: 429 });
}

/**
 * Stub EmbeddingProvider that fails with a retryable rate-limit error for the
 * first `failuresBeforeSuccess` attempts, then returns a valid 768-element
 * vector. Tracks how many times `embed` was actually invoked so the test can
 * assert no attempts are consumed after the first success.
 */
function makeStubProvider(failuresBeforeSuccess: number) {
  let calls = 0;
  const provider: EmbeddingProvider = {
    id: "stub:test-model",
    model: "test-model",
    allowsAnonymous: true,
    async embed(): Promise<number[]> {
      calls += 1;
      if (calls <= failuresBeforeSuccess) {
        throw makeRateLimitError();
      }
      return makeVector();
    },
  };
  return { provider, getCalls: () => calls };
}

describe("callWithRetry (Property 8: a retry that succeeds returns the vector and consumes no further attempts)", () => {
  afterEach(() => {
    // Ensure real timers are restored even if a property run throws.
    vi.useRealTimers();
  });

  // Property 8: for any number k of retryable failures in [0, 5], a provider
  // that succeeds on the (k+1)-th attempt causes exactly k+1 invocations of
  // `embed`, returns the resulting 768-element vector, and makes no further
  // attempts (the remaining retries are not consumed).
  it("invokes embed exactly k+1 times and returns the vector when success follows k retryable failures", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (k) => {
        // Backoff between attempts uses real setTimeout; fake timers let us
        // advance through the waits without real delay.
        vi.useFakeTimers();
        try {
          const { provider, getCalls } = makeStubProvider(k);

          const promise = callWithRetry(provider, "some valid text");
          // Drive all pending backoff timers (and the microtasks between them)
          // so the retry loop runs to completion without real waits.
          await vi.runAllTimersAsync();
          const vector = await promise;

          // Returns the success vector of exactly 768 elements.
          expect(vector).toHaveLength(REQUIRED_DIMENSION);
          // Exactly k+1 invocations: k retryable failures + 1 success, with no
          // further attempts consumed after the success.
          expect(getCalls()).toBe(k + 1);
        } finally {
          vi.useRealTimers();
        }
      }),
      { numRuns: 100 },
    );
  });
});
