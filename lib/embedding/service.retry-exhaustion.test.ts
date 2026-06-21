// Feature: free-chunking-embedding-api, Property 7: Persistent rate-limiting
// retries exactly five times then fails terminally.
//
// For any chunk whose provider always returns a Rate_Limit_Error, the
// Embedding_Service invokes that provider exactly 6 times (initial + 5 retries),
// then raises a terminal EmbeddingError identifying the final failure reason,
// and produces no vector.
//
// Validates: Requirements 4.1, 4.3

import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { callWithRetry } from "./service";
import { EmbeddingError } from "./errors";
import type { EmbeddingProvider } from "./provider";

// MAX_RETRIES = 5, so the bounded loop performs 1 initial attempt + 5 retries.
const EXPECTED_TOTAL_INVOCATIONS = 6;

/**
 * A stub EmbeddingProvider whose `embed` always rejects with a rate-limit error
 * produced by `makeError`. The provider also counts how many times `embed` was
 * invoked so the test can assert the exact number of attempts. No real network
 * or HfInference dependency is involved.
 */
function makeAlwaysRateLimitedProvider(
  id: string,
  makeError: () => unknown,
): { provider: EmbeddingProvider; getCount: () => number } {
  let callCount = 0;
  const provider: EmbeddingProvider = {
    id,
    model: "stub-model",
    allowsAnonymous: true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    embed: async (_text: string, _signal: AbortSignal): Promise<number[]> => {
      callCount += 1;
      throw makeError();
    },
  };
  return { provider, getCount: () => callCount };
}

// Rate-limit errors take several shapes the service recognizes: a 429/503 status
// surfaced on any probed field, or a textual rate-limit marker. Each arbitrary
// yields a *factory* so every attempt throws a fresh, independent error value.
const rateLimitErrorFactoryArb: fc.Arbitrary<() => unknown> = fc.oneof(
  fc.constantFrom(429, 503).map((code) => () => ({ status: code })),
  fc.constantFrom(429, 503).map((code) => () => ({ statusCode: code })),
  fc.constantFrom(429, 503).map((code) => () => ({ response: { status: code } })),
  fc.constantFrom(429, 503).map((code) => () => ({ httpResponse: { status: code } })),
  fc
    .constantFrom(
      "rate limit exceeded",
      "rate-limit hit, retry later",
      "Too Many Requests",
      "Service Unavailable",
      "HTTP 429 received",
      "provider returned 503",
    )
    .map((message) => () => new Error(message)),
);

const providerIdArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => `huggingface:${s}`);

// Valid (non-empty, within bounds) text to embed; content is irrelevant because
// the stub provider rejects regardless, but we exercise the real input space.
const textArb = fc.string({ minLength: 1, maxLength: 256 }).filter((t) => t.trim().length > 0);

describe("callWithRetry (Property 7: persistent rate-limit exhaustion)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the provider exactly 6 times then throws a terminal EmbeddingError", async () => {
    await fc.assert(
      fc.asyncProperty(
        providerIdArb,
        rateLimitErrorFactoryArb,
        textArb,
        async (id, makeError, text) => {
          // Use fake timers so the bounded exponential backoff (1s..32s) does
          // not make the test wait real seconds. Reset per run.
          vi.useFakeTimers();
          try {
            const { provider, getCount } = makeAlwaysRateLimitedProvider(id, makeError);

            // Start the retry loop. It will not settle until every backoff
            // sleep has elapsed, so we must advance timers while it is pending.
            const pending = callWithRetry(provider, text);

            // Capture the settlement without leaving an unhandled rejection
            // while we drive the fake clock forward.
            const settled = pending.then(
              (vector) => ({ resolved: true as const, vector }),
              (error: unknown) => ({ resolved: false as const, error }),
            );

            // Interleave timer advancement with the pending promise: this flushes
            // each backoff sleep and the microtasks that schedule the next attempt.
            await vi.runAllTimersAsync();

            const outcome = await settled;

            // It must fail terminally (no vector produced).
            expect(outcome.resolved).toBe(false);
            if (outcome.resolved) {
              return; // unreachable; keeps types narrow
            }

            // The thrown value is a terminal EmbeddingError naming the failure.
            expect(outcome.error).toBeInstanceOf(EmbeddingError);
            const err = outcome.error as EmbeddingError;
            expect(err.category).toBe("rate-limit");
            expect(err.providersAttempted).toEqual([id]);
            expect(err.message).toContain(id);

            // Exactly initial + 5 retries = 6 invocations of the provider.
            expect(getCount()).toBe(EXPECTED_TOTAL_INVOCATIONS);
          } finally {
            vi.useRealTimers();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
