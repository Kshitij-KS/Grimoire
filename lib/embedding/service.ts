// Feature: free-chunking-embedding-api
// Pure service helpers for the hardened Embedding_Service.
//
// This module centralizes the deterministic, highly-testable logic that guards
// the embedding call path. The first such helper, `validateInput`, enforces the
// input contract for `embedText` BEFORE any Embedding_Provider is invoked, so
// invalid input never consumes a network request (R2.4, R2.5, R7.5).

import {
  BACKOFF_CAP_MS,
  BACKOFF_START_MS,
  MAX_INPUT_CHARS,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  REQUIRED_DIMENSION,
} from "./constants";
import { EmbeddingError, type FailureCategory } from "./errors";
import {
  consoleEmbeddingLogger,
  type EmbeddingLogger,
} from "./logger";
// Type-only import: `provider.ts` imports `validateDimension` from this module
// at runtime, so importing `EmbeddingProvider` as a *type* here avoids creating
// a runtime circular import (the type is erased at compile time).
import type { EmbeddingProvider } from "./provider";

/**
 * Validate text input before any Embedding_Provider call.
 *
 * Rejects, with an `invalid-input` {@link EmbeddingError}:
 * - empty or whitespace-only text (R2.4, R7.5)
 * - text longer than {@link MAX_INPUT_CHARS} (8192) characters, naming both the
 *   actual length and the maximum (R2.5)
 *
 * This guard runs before any provider invocation, so callers on both the write
 * path (Lore_Pipeline) and the read path (Query_Path) never issue a provider
 * request for input that cannot produce a valid embedding.
 *
 * @param text - The text to validate.
 * @throws {EmbeddingError} with `category: "invalid-input"` when the input is
 *   empty/whitespace-only or exceeds the maximum length.
 */
export function validateInput(text: string): void {
  if (text.trim().length === 0) {
    throw new EmbeddingError(
      "Embedding input is empty or contains only whitespace characters.",
      { category: "invalid-input" }
    );
  }

  if (text.length > MAX_INPUT_CHARS) {
    throw new EmbeddingError(
      `Embedding input length ${text.length} exceeds the maximum allowed length of ${MAX_INPUT_CHARS} characters.`,
      { category: "invalid-input" }
    );
  }
}

/**
 * Compute the backoff delay before a given retry attempt.
 *
 * Implements the bounded exponential backoff schedule (R4.2): the delay doubles
 * on each successive attempt, starting at {@link BACKOFF_START_MS} (1s) and
 * capped at {@link BACKOFF_CAP_MS} (60s). For attempt `n` (1-based), the delay
 * is `min(2^(n-1) * BACKOFF_START_MS, BACKOFF_CAP_MS)` milliseconds, producing
 * the sequence 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped) ...
 *
 * The result is non-decreasing in `attempt` and never exceeds
 * {@link BACKOFF_CAP_MS}.
 *
 * @param attempt - The 1-based attempt index (the first retry is attempt 1).
 * @returns The delay to wait before the attempt, in milliseconds.
 */
export function backoffDelayMs(attempt: number): number {
  const exponential = Math.pow(2, attempt - 1) * BACKOFF_START_MS;
  return Math.min(exponential, BACKOFF_CAP_MS);
}

/**
 * Validate that a provider-returned vector has exactly the required dimension.
 *
 * Enforces the hard database constraint that every Embedding_Vector must have
 * length {@link REQUIRED_DIMENSION} (768). The Supabase pgvector columns
 * (`lore_chunks.embedding`, `semantic_cache.embedding`) are fixed at
 * `vector(768)`, so a vector of any other length cannot be persisted or used in
 * the `match_lore_chunks` / `match_semantic_cache` RPCs.
 *
 * On success the vector is returned unchanged. Otherwise a `dimension-mismatch`
 * {@link EmbeddingError} is thrown naming both the actual element count and the
 * expected count of 768 (`actualDimension` and `expectedDimension` are set). A
 * vector whose length is not 768 is never returned, so no caller can persist or
 * query with a mis-dimensioned vector (R1.6, R2.2, R7.4).
 *
 * @param vec - The embedding vector returned by an Embedding_Provider.
 * @returns The same vector when its length equals {@link REQUIRED_DIMENSION}.
 * @throws {EmbeddingError} with `category: "dimension-mismatch"` when the
 *   vector length is not 768.
 */
export function validateDimension(vec: number[]): number[] {
  if (vec.length !== REQUIRED_DIMENSION) {
    throw new EmbeddingError(
      `Embedding dimension mismatch: provider returned a vector of length ${vec.length}, but ${REQUIRED_DIMENSION} elements are required.`,
      {
        category: "dimension-mismatch",
        actualDimension: vec.length,
        expectedDimension: REQUIRED_DIMENSION,
      }
    );
  }

  return vec;
}

/**
 * Extract an HTTP-like status code from an arbitrary thrown value.
 *
 * Different layers of the HuggingFace client and the underlying `fetch` surface
 * status codes on different shapes (`status`, `statusCode`, or nested under
 * `response`/`httpResponse`). This helper probes those locations without
 * assuming any particular error class, returning the first numeric status it
 * finds or `undefined` when none is present.
 */
function extractStatusCode(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  const record = err as Record<string, unknown>;
  const candidates: unknown[] = [
    record.status,
    record.statusCode,
    (record.response as Record<string, unknown> | undefined)?.status,
    (record.httpResponse as Record<string, unknown> | undefined)?.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Detect whether an error represents a provider rate-limit / throttling signal.
 *
 * A Rate_Limit_Error is recognized from either an HTTP status of 429 (Too Many
 * Requests) or 503 (Service Unavailable, used by HuggingFace as a transient
 * retry signal), or from textual markers in the error message when no numeric
 * status is available. Only these signals qualify as `rate-limit`; nothing else
 * is treated as a rate-limit (R8.2).
 */
function isRateLimitSignal(err: unknown): boolean {
  const status = extractStatusCode(err);
  if (status === 429 || status === 503) {
    return true;
  }

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const normalized = message.toLowerCase();

  return (
    /\b(429|503)\b/.test(normalized) ||
    normalized.includes("rate limit") ||
    normalized.includes("rate-limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("service unavailable")
  );
}

/**
 * Classify any thrown value into exactly one {@link FailureCategory}.
 *
 * This function is **total**: every possible input maps to exactly one of the
 * five categories, so failure logging always records a well-defined category
 * (R8.1). The classification rules are:
 *
 * - An existing {@link EmbeddingError} keeps its already-assigned `category`,
 *   so categories decided at the point of failure (e.g. `dimension-mismatch`,
 *   `invalid-input`, `unrecognized-response`) are preserved rather than
 *   re-derived.
 * - Any value carrying a 429/503 status or an equivalent textual rate-limit
 *   signal maps to `rate-limit`, and nothing else maps to `rate-limit` (R8.2).
 * - Every remaining value (timeouts, network failures, configuration errors,
 *   and unrecognized values) maps to `other`.
 *
 * @param err - The thrown value to classify. May be any type.
 * @returns Exactly one {@link FailureCategory}.
 */
export function classifyError(err: unknown): FailureCategory {
  if (err instanceof EmbeddingError) {
    return err.category;
  }

  if (isRateLimitSignal(err)) {
    return "rate-limit";
  }

  return "other";
}

// ---------------------------------------------------------------------------
// Retry / backoff orchestration
// ---------------------------------------------------------------------------

/** Total invocations per provider: the initial request plus {@link MAX_RETRIES}. */
const MAX_ATTEMPTS = MAX_RETRIES + 1;

/**
 * Resolve after `ms` milliseconds. Extracted so the retry loop's backoff wait
 * is a single, easily fake-timer-driven call in tests.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Failure categories that are terminal — they are never retried because
 * retrying cannot change the outcome. A `dimension-mismatch` means the model
 * emits the wrong vector length on every call, and `invalid-input` is decided
 * before any provider call, so both fail immediately (see the design retry
 * state machine). Every other category (`rate-limit`, `other`, etc.) is
 * retryable up to the bounded maximum.
 */
function isTerminalCategory(category: FailureCategory): boolean {
  return category === "dimension-mismatch" || category === "invalid-input";
}

/**
 * Extract a human-readable message from an arbitrary thrown value for use in
 * the terminal error that names the final failure reason.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return String(err);
}

/**
 * Invoke a provider exactly once with a {@link REQUEST_TIMEOUT_MS} per-request
 * timeout enforced via an {@link AbortController}.
 *
 * A timer aborts the request when the timeout elapses; on abort the provider's
 * `embed` rejects and this function raises a retryable `other`
 * {@link EmbeddingError} naming the timeout, so the caller treats a timed-out
 * request like any other transient (network) failure (R2.6). The timer is always
 * cleared, whether the request succeeds, fails, or times out.
 *
 * @param provider - The Embedding_Provider to invoke.
 * @param text - The text to embed (already validated by the caller).
 * @returns The raw vector returned by the provider (dimension not yet checked).
 */
async function callOnce(
  provider: EmbeddingProvider,
  text: string,
): Promise<number[]> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await provider.embed(text, controller.signal);
  } catch (err) {
    if (timedOut) {
      throw new EmbeddingError(
        `Embedding provider ${provider.id} did not respond within ${REQUEST_TIMEOUT_MS} ms.`,
        { category: "other", cause: err },
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A single failed embedding attempt, reported to {@link RetryHooks.onAttemptFailure}
 * as the retry loop runs. Lets the caller emit a structured failure log per
 * failed attempt without `callWithRetry` taking a dependency on the logger.
 */
export interface AttemptFailure {
  /** The provider whose invocation failed. */
  providerId: string;
  /** The 1-based attempt index within this provider. */
  attempt: number;
  /** The classified failure category for this attempt. */
  category: FailureCategory;
  /** Human-readable description of the failure reason. */
  message: string;
}

/**
 * Optional observability hooks for {@link callWithRetry}.
 *
 * `onAttemptFailure` fires exactly once for every failed provider invocation
 * (whether the failure is terminal or will be retried), so callers can record a
 * structured failure log per attempt and count the total attempts made.
 */
export interface RetryHooks {
  onAttemptFailure?: (failure: AttemptFailure) => void;
}

/**
 * Drive a single Embedding_Provider with bounded retries and exponential
 * backoff.
 *
 * Performs up to {@link MAX_ATTEMPTS} total invocations (the initial request
 * plus {@link MAX_RETRIES} retries) of `provider.embed`, each guarded by a
 * {@link REQUEST_TIMEOUT_MS} per-request timeout (R4.1). Behavior per attempt:
 *
 * - **Success**: returns the vector immediately and makes no further attempts,
 *   consuming none of the remaining retries (R4.4, R4.5).
 * - **Terminal failure** (`dimension-mismatch` / `invalid-input`): rethrows at
 *   once without retrying, since retrying cannot change the result.
 * - **Retryable failure** (`rate-limit`, timeout/network `other`, etc.): waits
 *   {@link backoffDelayMs} for the just-failed attempt index and retries, until
 *   the attempts are exhausted.
 *
 * On retryable exhaustion it raises an {@link EmbeddingError} that preserves the
 * final failure category, names the provider and the final failure reason, and
 * records the provider in `providersAttempted` (R4.3). This function validates
 * only retry/timeout behavior; dimension validation is applied by the caller
 * (`embedText`) after a successful vector is returned.
 *
 * @param provider - The Embedding_Provider to drive.
 * @param text - The text to embed (already validated by the caller).
 * @returns The raw vector from the first successful attempt.
 * @throws {EmbeddingError} on a terminal failure, or after all retryable
 *   attempts are exhausted.
 */
export async function callWithRetry(
  provider: EmbeddingProvider,
  text: string,
  hooks?: RetryHooks,
): Promise<number[]> {
  let lastError: unknown;
  let lastCategory: FailureCategory = "other";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callOnce(provider, text);
    } catch (err) {
      const category = classifyError(err);
      lastError = err;
      lastCategory = category;

      // Report the failed attempt so the caller can emit a structured failure
      // log and count total attempts; fires for both terminal and retryable
      // failures (R8.1).
      hooks?.onAttemptFailure?.({
        providerId: provider.id,
        attempt,
        category,
        message: describeError(err),
      });

      // Terminal errors cannot be improved by retrying — fail fast.
      if (isTerminalCategory(category)) {
        throw err;
      }

      // Retryable error with attempts remaining: wait the backoff for the
      // attempt that just failed, then try again.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelayMs(attempt));
      }
    }
  }

  // All retryable attempts exhausted: raise a terminal error naming the final
  // failure reason and the provider that was attempted.
  throw new EmbeddingError(
    `Embedding provider ${provider.id} failed after ${MAX_ATTEMPTS} attempts (${lastCategory}): ${describeError(lastError)}`,
    {
      category: lastCategory,
      providersAttempted: [provider.id],
      cause: lastError,
    },
  );
}

// ---------------------------------------------------------------------------
// Public surface: embedText (validation -> retry -> dimension -> fallback)
// ---------------------------------------------------------------------------

/**
 * Optional dependencies for {@link embedText}.
 *
 * All fields are optional so the public contract remains
 * `embedText(text): Promise<number[]>`. Tests inject `primary`, `fallback`, and
 * `logger` to drive the orchestration deterministically; production resolves the
 * Primary_Provider and the optional, config-gated Fallback_Provider from Config.
 */
export interface EmbedTextOptions {
  /** Override the Primary_Provider (defaults to the configured HuggingFace provider). */
  primary?: EmbeddingProvider;
  /**
   * Override the Fallback_Provider. When `primary` is supplied this value is used
   * verbatim (an explicit `undefined` means "no fallback"); otherwise the
   * config-gated fallback is resolved from Config.
   */
  fallback?: EmbeddingProvider;
  /** Observability sink; defaults to {@link consoleEmbeddingLogger}. */
  logger?: EmbeddingLogger;
  /** Zero-based originating chunk index, recorded on write-path failure logs (R8.3). */
  chunkIndex?: number;
}

/**
 * Wrap a provider so its returned vector is dimension-validated as part of the
 * attempt. A non-768 vector therefore surfaces as a `dimension-mismatch`
 * {@link EmbeddingError} inside {@link callWithRetry}, where it is treated as a
 * terminal (non-retryable) failure. This unifies dimension enforcement across
 * the Primary_Provider and any Fallback_Provider so the service never returns,
 * persists, or queries with a mis-dimensioned vector (R1.6, R2.2, R7.4).
 */
function withDimensionValidation(provider: EmbeddingProvider): EmbeddingProvider {
  return {
    id: provider.id,
    model: provider.model,
    allowsAnonymous: provider.allowsAnonymous,
    async embed(text: string, signal: AbortSignal): Promise<number[]> {
      const vector = await provider.embed(text, signal);
      return validateDimension(vector);
    },
  };
}

/**
 * Resolve the Primary_Provider and optional Fallback_Provider for a call.
 *
 * When a `primary` override is supplied (tests), it is used as-is along with the
 * supplied `fallback` (which may be intentionally `undefined`). Otherwise both
 * are resolved from Config via a lazy dynamic import of `./provider`, which
 * avoids a static runtime circular import between this module and `provider.ts`.
 */
async function resolveProviders(
  options: EmbedTextOptions,
): Promise<{ primary: EmbeddingProvider; fallback?: EmbeddingProvider }> {
  if (options.primary) {
    return { primary: options.primary, fallback: options.fallback };
  }

  const { createPrimaryProvider, createFallbackProvider } = await import("./provider");
  return {
    primary: createPrimaryProvider(),
    fallback: options.fallback ?? createFallbackProvider(),
  };
}

/**
 * Convert text into a 768-dimensional embedding vector.
 *
 * Composes the full hardened pipeline:
 * 1. {@link validateInput} rejects empty/whitespace-only or over-length text
 *    before any provider is contacted (R2.4, R2.5, R7.5).
 * 2. {@link callWithRetry} drives the Primary_Provider with bounded exponential
 *    backoff and a per-request timeout; {@link withDimensionValidation} enforces
 *    the 768-element requirement on each successful attempt (R1.6, R2.2, R7.4).
 * 3. On Primary_Provider exhaustion (a retryable failure that ran out of
 *    attempts), the request is routed to the Fallback_Provider when one is
 *    configured; otherwise the Primary_Provider's final error is raised (R5.1,
 *    R5.3). Terminal failures (dimension-mismatch / invalid-input) are never
 *    routed to the fallback.
 * 4. When the fallback serves the request, its vector is returned and an
 *    observable indication is recorded (R5.4, R5.5). When the fallback is also
 *    exhausted, a combined error naming both providers and the final reason is
 *    raised (R5.6).
 *
 * Throughout, a structured {@link EmbeddingLogger.logFailure} record is emitted
 * for every failed attempt (R8.1, R8.2, R8.3), and a single
 * {@link EmbeddingLogger.logTerminal} record listing every provider attempted
 * and the total attempt count is emitted on terminal failure (R8.4).
 *
 * @param text - The text to embed.
 * @param options - Optional provider/logger overrides and the originating chunk
 *   index; see {@link EmbedTextOptions}. The public contract is preserved:
 *   callers may invoke `embedText(text)` with no options.
 * @returns A 768-element embedding vector.
 * @throws {EmbeddingError} on invalid input, dimension mismatch, unrecognized
 *   response, or terminal provider failure.
 */
export async function embedText(
  text: string,
  options: EmbedTextOptions = {},
): Promise<number[]> {
  const logger = options.logger ?? consoleEmbeddingLogger;
  const { chunkIndex } = options;

  // 1. Validate input before contacting any provider (R2.4, R2.5, R7.5).
  validateInput(text);

  const resolved = await resolveProviders(options);
  const primary = withDimensionValidation(resolved.primary);
  const fallback = resolved.fallback
    ? withDimensionValidation(resolved.fallback)
    : undefined;

  const providersAttempted: string[] = [];
  let totalAttempts = 0;

  // Shared hook: emit a structured failure log per failed attempt and count the
  // total attempts made across every provider (R8.1, R8.3, R8.4).
  const hooks: RetryHooks = {
    onAttemptFailure: (failure) => {
      totalAttempts += 1;
      logger.logFailure({
        providerId: failure.providerId,
        category: failure.category,
        attempt: failure.attempt,
        chunkIndex,
        message: failure.message,
      });
    },
  };

  // 2. Primary_Provider with bounded retry + dimension validation.
  providersAttempted.push(primary.id);
  let primaryError: unknown;
  try {
    return await callWithRetry(primary, text, hooks);
  } catch (err) {
    primaryError = err;
  }

  const primaryCategory = classifyError(primaryError);

  // Terminal (non-exhaustion) failures and the no-fallback case raise the
  // primary's final error directly — the fallback is reserved for retry
  // exhaustion only (R5.1, R5.3).
  if (isTerminalCategory(primaryCategory) || !fallback) {
    logger.logTerminal({
      providersAttempted,
      totalAttempts,
      finalCategory: primaryCategory,
      finalMessage: describeError(primaryError),
    });
    throw primaryError;
  }

  // 3. Route to the configured Fallback_Provider (R5.1).
  providersAttempted.push(fallback.id);
  try {
    const vector = await callWithRetry(fallback, text, hooks);
    // 4a. Fallback served the request — record the observable indication (R5.4)
    // and return its 768-element vector (R5.5).
    logger.logFallbackServed({ primaryId: primary.id, fallbackId: fallback.id });
    return vector;
  } catch (fallbackError) {
    // 4b. Both providers exhausted — raise a combined error naming both and the
    // final failure reason (R5.6).
    const finalCategory = classifyError(fallbackError);
    const finalMessage = describeError(fallbackError);
    logger.logTerminal({
      providersAttempted,
      totalAttempts,
      finalCategory,
      finalMessage,
    });
    throw new EmbeddingError(
      `Embedding failed: primary provider ${primary.id} and fallback provider ${fallback.id} both failed after exhausting their retries. Final reason (${finalCategory}): ${finalMessage}`,
      {
        category: finalCategory,
        providersAttempted: [primary.id, fallback.id],
        cause: fallbackError,
      },
    );
  }
}
