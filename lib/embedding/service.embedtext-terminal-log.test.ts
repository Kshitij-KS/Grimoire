// Feature: free-chunking-embedding-api, Property 13: Terminal failure log names
// every provider attempted and the total attempt count.
//
// For any request that exhausts all retries on the Primary_Provider and a
// configured Fallback_Provider without success, the single terminal failure log
// emitted by `embedText` lists exactly the set of providers attempted (both the
// primary and the fallback id) and a total attempt count equal to the sum of
// attempts made across those providers — 6 (initial + 5 retries) per provider,
// so 12 in total.
//
// Validates: Requirements 8.4

import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { embedText } from "./service";
import type { EmbeddingProvider } from "./provider";
import type {
  EmbeddingLogger,
  EmbeddingFailureLog,
  TerminalFailureLog,
  FallbackServedLog,
} from "./logger";

// MAX_RETRIES = 5, so each provider is invoked 1 (initial) + 5 (retries) = 6
// times before its retries are exhausted. With both the primary and fallback
// exhausted, the total across both providers is 12.
const ATTEMPTS_PER_PROVIDER = 6;
const EXPECTED_TOTAL_ATTEMPTS = ATTEMPTS_PER_PROVIDER * 2;

/**
 * A stub EmbeddingProvider whose `embed` always rejects with a fresh, retryable
 * error produced by `makeError`. No real network or HfInference dependency is
 * involved — the service drives it purely through the injected `primary` /
 * `fallback` options.
 */
function makeAlwaysFailingProvider(
  id: string,
  makeError: () => unknown,
): EmbeddingProvider {
  return {
    id,
    model: "stub-model",
    allowsAnonymous: true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    embed: async (_text: string, _signal: AbortSignal): Promise<number[]> => {
      throw makeError();
    },
  };
}

/**
 * A spy {@link EmbeddingLogger} that captures every terminal failure record so
 * the property can assert on the providers attempted and the total attempt
 * count. The other sinks are no-ops (they are exercised, but not asserted here).
 */
function makeSpyLogger(): {
  logger: EmbeddingLogger;
  terminalLogs: TerminalFailureLog[];
} {
  const terminalLogs: TerminalFailureLog[] = [];
  const logger: EmbeddingLogger = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logFailure(_log: EmbeddingFailureLog): void {},
    logTerminal(log: TerminalFailureLog): void {
      terminalLogs.push(log);
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logFallbackServed(_log: FallbackServedLog): void {},
  };
  return { logger, terminalLogs };
}

// Retryable errors take several shapes the service recognizes as retryable: a
// 429/503 rate-limit status surfaced on any probed field, a textual rate-limit
// marker, or a generic `other` failure (network/timeout-like). Each arbitrary
// yields a *factory* so every attempt throws a fresh, independent error value.
const retryableErrorFactoryArb: fc.Arbitrary<() => unknown> = fc.oneof(
  fc.constantFrom(429, 503).map((code) => () => ({ status: code })),
  fc.constantFrom(429, 503).map((code) => () => ({ statusCode: code })),
  fc.constantFrom(429, 503).map((code) => () => ({ response: { status: code } })),
  fc.constantFrom(429, 503).map((code) => () => ({ httpResponse: { status: code } })),
  fc
    .constantFrom(
      "rate limit exceeded",
      "Too Many Requests",
      "Service Unavailable",
      "HTTP 429 received",
      "provider returned 503",
    )
    .map((message) => () => new Error(message)),
  // Generic network/connection failures classify as the retryable `other`
  // category (not terminal), so they too exhaust the bounded retries.
  fc
    .constantFrom(
      "network error: ECONNRESET",
      "socket hang up",
      "connection reset by peer",
    )
    .map((message) => () => new Error(message)),
);

const providerIdArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => `huggingface:${s}`);

// Valid (non-empty, within bounds) text to embed; content is irrelevant because
// both stub providers reject regardless, but we exercise the real input space.
const textArb = fc
  .string({ minLength: 1, maxLength: 256 })
  .filter((t) => t.trim().length > 0);

describe("embedText (Property 13: terminal failure log lists every provider attempted and total attempts)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs one terminal failure naming both providers and totalAttempts = 12", async () => {
    await fc.assert(
      fc.asyncProperty(
        providerIdArb,
        providerIdArb,
        retryableErrorFactoryArb,
        retryableErrorFactoryArb,
        textArb,
        async (rawPrimaryId, rawFallbackId, makePrimaryError, makeFallbackError, text) => {
          // Ensure distinct provider ids so "the set of providers attempted" is
          // unambiguous (both ids must appear in providersAttempted).
          const primaryId = `primary:${rawPrimaryId}`;
          const fallbackId = `fallback:${rawFallbackId}`;

          // Use fake timers so the bounded exponential backoff (1s..32s) per
          // provider does not make the test wait real seconds. Reset per run.
          vi.useFakeTimers();
          try {
            const primary = makeAlwaysFailingProvider(primaryId, makePrimaryError);
            const fallback = makeAlwaysFailingProvider(fallbackId, makeFallbackError);
            const { logger, terminalLogs } = makeSpyLogger();

            // Inject both providers + the spy logger. With `primary` supplied,
            // the supplied `fallback` is used verbatim.
            const pending = embedText(text, { primary, fallback, logger });

            // Capture settlement without leaving an unhandled rejection while we
            // drive the fake clock forward.
            const settled = pending.then(
              (vector) => ({ resolved: true as const, vector }),
              (error: unknown) => ({ resolved: false as const, error }),
            );

            // Flush every backoff sleep across both providers and the microtasks
            // that schedule the next attempt / the fallback handoff.
            await vi.runAllTimersAsync();

            const outcome = await settled;

            // Both providers exhausted: the request fails terminally, no vector.
            expect(outcome.resolved).toBe(false);

            // Exactly one terminal failure record is emitted.
            expect(terminalLogs).toHaveLength(1);
            const terminal = terminalLogs[0];

            // providersAttempted names every provider attempted — both ids, in
            // order (primary first, then fallback).
            expect(terminal.providersAttempted).toEqual([primaryId, fallbackId]);
            // It contains every attempted provider id (set membership).
            expect(terminal.providersAttempted).toContain(primaryId);
            expect(terminal.providersAttempted).toContain(fallbackId);

            // totalAttempts equals the sum of attempts across both providers:
            // 6 (primary) + 6 (fallback) = 12.
            expect(terminal.totalAttempts).toBe(EXPECTED_TOTAL_ATTEMPTS);
          } finally {
            vi.useRealTimers();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
