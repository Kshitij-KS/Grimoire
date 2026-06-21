// Feature: free-chunking-embedding-api
// Task 6.8: Unit tests for fallback exhaustion and the 30s per-request timeout.
//
// These are example-based unit tests (vitest) that drive `embedText`'s
// orchestration deterministically with fake timers. They cover three behaviors:
//   1. No fallback configured + primary exhausts retries -> embedText throws the
//      primary's final EmbeddingError (R5.3).
//   2. Primary AND fallback both exhaust retries -> embedText throws a combined
//      EmbeddingError naming BOTH provider ids and the final reason (R5.6).
//   3. A provider whose `embed` never resolves within REQUEST_TIMEOUT_MS (30s)
//      has its per-request AbortController fire, producing a retryable "other"
//      failure; after exhaustion embedText throws a provider-failed error and
//      returns no vector (R2.6).
//
// Validates: Requirements 2.6, 5.3, 5.6

import { afterEach, describe, expect, it, vi } from "vitest";

import { embedText } from "./service";
import { EmbeddingError } from "./errors";
import { MAX_RETRIES, REQUEST_TIMEOUT_MS } from "./constants";
import type { EmbeddingLogger } from "./logger";
import type { EmbeddingProvider } from "./provider";

// MAX_RETRIES = 5, so each provider is invoked 1 initial + 5 retries = 6 times.
const EXPECTED_TOTAL_INVOCATIONS = MAX_RETRIES + 1;

// Valid (non-empty, within-bounds) text so `validateInput` always passes and the
// orchestration actually reaches the provider call path.
const TEXT = "harden the embedding call path";

/**
 * A stub EmbeddingProvider whose `embed` always rejects with a fresh rate-limit
 * error, counting invocations so the test can assert the bounded attempt total.
 * A 429 status makes the service classify the failure as `rate-limit`, which is
 * retryable (and therefore eligible for fallback routing on exhaustion).
 */
function makeAlwaysRateLimitedProvider(id: string): {
  provider: EmbeddingProvider;
  getCount: () => number;
} {
  let callCount = 0;
  const provider: EmbeddingProvider = {
    id,
    model: "stub-model",
    allowsAnonymous: true,
    embed: async (): Promise<number[]> => {
      callCount += 1;
      throw { status: 429, message: "Too Many Requests" };
    },
  };
  return { provider, getCount: () => callCount };
}

/**
 * A stub EmbeddingProvider whose `embed` never resolves on its own; it only
 * settles (by rejecting) when the per-request AbortController fires. This models
 * a provider that hangs, so the service's REQUEST_TIMEOUT_MS timer is the only
 * thing that can settle the call. Counts invocations for the attempt assertion.
 */
function makeHangingProvider(id: string): {
  provider: EmbeddingProvider;
  getCount: () => number;
} {
  let callCount = 0;
  const provider: EmbeddingProvider = {
    id,
    model: "stub-model",
    allowsAnonymous: true,
    embed: (_text: string, signal: AbortSignal): Promise<number[]> =>
      new Promise<number[]>((_resolve, reject) => {
        callCount += 1;
        // Reject only when the service aborts via the per-request timeout.
        signal.addEventListener("abort", () => {
          reject(new Error("request aborted by timeout"));
        });
      }),
  };
  return { provider, getCount: () => callCount };
}

/** A logger that records each structured record so the test can assert on it. */
function makeRecordingLogger(): {
  logger: EmbeddingLogger;
  failures: Parameters<EmbeddingLogger["logFailure"]>[0][];
  terminals: Parameters<EmbeddingLogger["logTerminal"]>[0][];
  fallbackServed: Parameters<EmbeddingLogger["logFallbackServed"]>[0][];
} {
  const failures: Parameters<EmbeddingLogger["logFailure"]>[0][] = [];
  const terminals: Parameters<EmbeddingLogger["logTerminal"]>[0][] = [];
  const fallbackServed: Parameters<EmbeddingLogger["logFallbackServed"]>[0][] = [];
  const logger: EmbeddingLogger = {
    logFailure: (log) => {
      failures.push(log);
    },
    logTerminal: (log) => {
      terminals.push(log);
    },
    logFallbackServed: (log) => {
      fallbackServed.push(log);
    },
  };
  return { logger, failures, terminals, fallbackServed };
}

/**
 * Run a pending embedText promise to settlement while driving the fake clock so
 * the bounded backoff sleeps and the 30s per-request timeouts elapse without
 * real waiting. Returns a discriminated outcome (never throws).
 */
async function settleWithFakeTimers(
  pending: Promise<number[]>,
): Promise<
  { resolved: true; vector: number[] } | { resolved: false; error: unknown }
> {
  const settled = pending.then(
    (vector) => ({ resolved: true as const, vector }),
    (error: unknown) => ({ resolved: false as const, error }),
  );
  // Flush every pending timer (backoff sleeps + the 30s timeout timers) and the
  // microtasks that schedule each subsequent attempt.
  await vi.runAllTimersAsync();
  return settled;
}

describe("embedText (Task 6.8: fallback exhaustion and 30s timeout)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("raises the primary's final error when no fallback is configured and the primary exhausts its retries (R5.3)", async () => {
    vi.useFakeTimers();

    const { provider: primary, getCount } = makeAlwaysRateLimitedProvider(
      "huggingface:primary-model",
    );
    const { logger, terminals, fallbackServed } = makeRecordingLogger();

    const outcome = await settleWithFakeTimers(
      // Explicit `undefined` fallback => "no fallback configured".
      embedText(TEXT, { primary, fallback: undefined, logger }),
    );

    // No vector is produced; embedText fails terminally.
    expect(outcome.resolved).toBe(false);
    if (outcome.resolved) return;

    // The raised error is the primary's own final retry-exhaustion error.
    expect(outcome.error).toBeInstanceOf(EmbeddingError);
    const err = outcome.error as EmbeddingError;
    expect(err.category).toBe("rate-limit");
    // Only the primary was attempted (the fallback was never routed to).
    expect(err.providersAttempted).toEqual(["huggingface:primary-model"]);
    expect(err.message).toContain("huggingface:primary-model");

    // Primary was invoked exactly 1 initial + 5 retries = 6 times.
    expect(getCount()).toBe(EXPECTED_TOTAL_INVOCATIONS);

    // The fallback path was never taken.
    expect(fallbackServed).toHaveLength(0);

    // A single terminal record names only the primary and the total attempts.
    expect(terminals).toHaveLength(1);
    expect(terminals[0].providersAttempted).toEqual(["huggingface:primary-model"]);
    expect(terminals[0].totalAttempts).toBe(EXPECTED_TOTAL_INVOCATIONS);
    expect(terminals[0].finalCategory).toBe("rate-limit");
  });

  it("raises a combined error naming BOTH providers when primary and fallback both exhaust their retries (R5.6)", async () => {
    vi.useFakeTimers();

    const { provider: primary, getCount: primaryCount } =
      makeAlwaysRateLimitedProvider("huggingface:primary-model");
    const { provider: fallback, getCount: fallbackCount } =
      makeAlwaysRateLimitedProvider("fallback:huggingface:fallback-model");
    const { logger, terminals } = makeRecordingLogger();

    const outcome = await settleWithFakeTimers(
      embedText(TEXT, { primary, fallback, logger }),
    );

    // No vector is produced; embedText fails terminally.
    expect(outcome.resolved).toBe(false);
    if (outcome.resolved) return;

    // The combined error names BOTH provider ids and the final reason.
    expect(outcome.error).toBeInstanceOf(EmbeddingError);
    const err = outcome.error as EmbeddingError;
    expect(err.category).toBe("rate-limit");
    expect(err.providersAttempted).toEqual([
      "huggingface:primary-model",
      "fallback:huggingface:fallback-model",
    ]);
    expect(err.message).toContain("huggingface:primary-model");
    expect(err.message).toContain("fallback:huggingface:fallback-model");

    // Each provider was driven through its full bounded retry budget.
    expect(primaryCount()).toBe(EXPECTED_TOTAL_INVOCATIONS);
    expect(fallbackCount()).toBe(EXPECTED_TOTAL_INVOCATIONS);

    // The terminal record names both providers and sums attempts across them.
    expect(terminals).toHaveLength(1);
    expect(terminals[0].providersAttempted).toEqual([
      "huggingface:primary-model",
      "fallback:huggingface:fallback-model",
    ]);
    expect(terminals[0].totalAttempts).toBe(EXPECTED_TOTAL_INVOCATIONS * 2);
  });

  it("treats a provider that never responds within 30s as a retryable failure and, after exhaustion, fails with no vector (R2.6)", async () => {
    vi.useFakeTimers();

    const { provider: primary, getCount } = makeHangingProvider(
      "huggingface:primary-model",
    );
    const { logger, failures } = makeRecordingLogger();

    const outcome = await settleWithFakeTimers(
      embedText(TEXT, { primary, fallback: undefined, logger }),
    );

    // The hanging provider yields no vector; embedText fails terminally.
    expect(outcome.resolved).toBe(false);
    if (outcome.resolved) return;

    // The per-request timeout produces a retryable "other" failure that is
    // exhausted, so the final error is a provider-failed "other" error.
    expect(outcome.error).toBeInstanceOf(EmbeddingError);
    const err = outcome.error as EmbeddingError;
    expect(err.category).toBe("other");
    expect(err.providersAttempted).toEqual(["huggingface:primary-model"]);
    // The message names the provider and the 30s timeout bound.
    expect(err.message).toContain("huggingface:primary-model");

    // The timeout fired on every attempt: 1 initial + 5 retries = 6 invocations.
    expect(getCount()).toBe(EXPECTED_TOTAL_INVOCATIONS);

    // Every failure was logged as a retryable "other" category, and each
    // per-attempt failure message references the 30s timeout bound.
    expect(failures).toHaveLength(EXPECTED_TOTAL_INVOCATIONS);
    expect(failures.every((f) => f.category === "other")).toBe(true);
    expect(
      failures.every((f) => f.message.includes(String(REQUEST_TIMEOUT_MS))),
    ).toBe(true);
  });
});
