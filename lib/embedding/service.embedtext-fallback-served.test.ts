// Feature: free-chunking-embedding-api, Property 9: Configured fallback serves
// when the primary is exhausted.
//
// For any request where a Fallback_Provider is configured and the
// Primary_Provider fails after exhausting its bounded retries, the
// Embedding_Service invokes the Fallback_Provider with the same input text; when
// the fallback returns a successful 768-element vector, that vector is returned
// to the caller and an observable indication records that the Fallback_Provider
// (not the Primary_Provider) served the request.
//
// Validates: Requirements 5.1, 5.4, 5.5

import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { embedText } from "./service";
import { REQUIRED_DIMENSION } from "./constants";
import type {
  EmbeddingFailureLog,
  EmbeddingLogger,
  FallbackServedLog,
  TerminalFailureLog,
} from "./logger";
import type { EmbeddingProvider } from "./provider";

/**
 * A primary stub EmbeddingProvider whose `embed` always rejects with a fresh
 * rate-limit error, forcing the Embedding_Service to exhaust its bounded retries
 * and route to the configured fallback. Records the text it was called with and
 * counts invocations so the test can assert the same input reached the provider.
 */
function makeAlwaysRateLimitedPrimary(
  id: string,
  makeError: () => unknown,
): { provider: EmbeddingProvider; getCount: () => number; getTexts: () => string[] } {
  let callCount = 0;
  const texts: string[] = [];
  const provider: EmbeddingProvider = {
    id,
    model: "primary-stub-model",
    allowsAnonymous: true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    embed: async (text: string, _signal: AbortSignal): Promise<number[]> => {
      callCount += 1;
      texts.push(text);
      throw makeError();
    },
  };
  return { provider, getCount: () => callCount, getTexts: () => texts };
}

/**
 * A fallback stub EmbeddingProvider that returns a fixed, valid 768-element
 * numeric vector on the first call. Records the text it was invoked with so the
 * test can assert the fallback saw the SAME input the primary received (R5.1).
 */
function makeSucceedingFallback(
  id: string,
  vector: number[],
): { provider: EmbeddingProvider; getCount: () => number; getTexts: () => string[] } {
  let callCount = 0;
  const texts: string[] = [];
  const provider: EmbeddingProvider = {
    id,
    model: "fallback-stub-model",
    allowsAnonymous: false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    embed: async (text: string, _signal: AbortSignal): Promise<number[]> => {
      callCount += 1;
      texts.push(text);
      return vector;
    },
  };
  return { provider, getCount: () => callCount, getTexts: () => texts };
}

/**
 * A spy EmbeddingLogger that captures every record emitted by the service so the
 * test can assert that the observable fallback-served indication was recorded.
 */
function makeSpyLogger(): {
  logger: EmbeddingLogger;
  fallbackServed: FallbackServedLog[];
  terminal: TerminalFailureLog[];
  failures: EmbeddingFailureLog[];
} {
  const fallbackServed: FallbackServedLog[] = [];
  const terminal: TerminalFailureLog[] = [];
  const failures: EmbeddingFailureLog[] = [];
  const logger: EmbeddingLogger = {
    logFailure: (log) => {
      failures.push(log);
    },
    logTerminal: (log) => {
      terminal.push(log);
    },
    logFallbackServed: (log) => {
      fallbackServed.push(log);
    },
  };
  return { logger, fallbackServed, terminal, failures };
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

const primaryIdArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => `huggingface:${s}`);

const fallbackIdArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => `fallback:huggingface:${s}`);

// A valid, fixed-length (768) numeric vector for the fallback to return.
const fallbackVectorArb: fc.Arbitrary<number[]> = fc.array(
  fc.double({ min: -1, max: 1, noNaN: true }),
  { minLength: REQUIRED_DIMENSION, maxLength: REQUIRED_DIMENSION },
);

// Valid (non-empty, within bounds) text to embed.
const textArb = fc
  .string({ minLength: 1, maxLength: 256 })
  .filter((t) => t.trim().length > 0);

describe("embedText (Property 9: configured fallback serves on primary exhaustion)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the fallback's 768-element vector and records the fallback-served indication", async () => {
    await fc.assert(
      fc.asyncProperty(
        primaryIdArb,
        fallbackIdArb,
        rateLimitErrorFactoryArb,
        fallbackVectorArb,
        textArb,
        async (primaryId, fallbackId, makeError, fallbackVector, text) => {
          // Distinct ids so the assertions can attribute records unambiguously.
          fc.pre(primaryId !== fallbackId);

          // Use fake timers so the bounded exponential backoff (1s..32s) on the
          // primary does not make the test wait real seconds. Reset per run.
          vi.useFakeTimers();
          try {
            const primary = makeAlwaysRateLimitedPrimary(primaryId, makeError);
            const fallback = makeSucceedingFallback(fallbackId, fallbackVector);
            const spy = makeSpyLogger();

            const pending = embedText(text, {
              primary: primary.provider,
              fallback: fallback.provider,
              logger: spy.logger,
            });

            // Capture the settlement without leaving an unhandled rejection
            // while we drive the fake clock forward through the backoff sleeps.
            const settled = pending.then(
              (vector) => ({ resolved: true as const, vector }),
              (error: unknown) => ({ resolved: false as const, error }),
            );

            await vi.runAllTimersAsync();

            const outcome = await settled;

            // The fallback served the request: embedText resolved with a vector.
            expect(outcome.resolved).toBe(true);
            if (!outcome.resolved) {
              return; // unreachable; keeps types narrow
            }

            // The returned vector is exactly the fallback's 768-element vector
            // (R5.5).
            expect(outcome.vector).toHaveLength(REQUIRED_DIMENSION);
            expect(outcome.vector).toEqual(fallbackVector);

            // The primary was exhausted (6 invocations) before falling back, and
            // the fallback was invoked with the SAME input text (R5.1).
            expect(primary.getCount()).toBe(6);
            expect(fallback.getCount()).toBe(1);
            expect(fallback.getTexts()).toEqual([text]);

            // An observable indication records that the FALLBACK, not the
            // primary, served the request (R5.4).
            expect(spy.fallbackServed).toHaveLength(1);
            expect(spy.fallbackServed[0]).toEqual({
              primaryId,
              fallbackId,
            });

            // A success via fallback is not a terminal failure.
            expect(spy.terminal).toHaveLength(0);
          } finally {
            vi.useRealTimers();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
