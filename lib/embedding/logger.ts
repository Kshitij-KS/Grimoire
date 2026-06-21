// Feature: free-chunking-embedding-api
// Structured observability for the hardened Embedding_Service.
//
// All embedding failures are surfaced through a single, structured logging
// surface so operators can diagnose free-tier limit problems quickly (R8.x).
// The service layer emits:
//   - an `EmbeddingFailureLog` for every failed attempt (R8.1, R8.2, R8.3)
//   - a `TerminalFailureLog` once all retries and any configured fallback are
//     exhausted, naming every provider attempted and the total attempt count
//     (R8.4)
//   - a `FallbackServedLog` whenever the Fallback_Provider, rather than the
//     Primary_Provider, served a request (R5.4)
//
// The logger is an injectable interface so tests can observe the exact records
// emitted without scraping the console; production uses {@link consoleEmbeddingLogger}.

import type { FailureCategory } from "./errors";

/**
 * A structured record describing a single failed embedding attempt.
 *
 * Emitted once per failed provider invocation (R8.1). The `category` is exactly
 * one {@link FailureCategory} and `attempt` is the 1-based attempt index within
 * the provider that failed. `chunkIndex` is present only on the write path
 * (Lore_Pipeline), where it identifies the zero-based originating chunk (R8.3).
 */
export interface EmbeddingFailureLog {
  /** The provider that issued the failed request, e.g. `"huggingface:..."`. */
  providerId: string;
  /** The failure category — exactly one {@link FailureCategory} value (R8.1). */
  category: FailureCategory;
  /** The 1-based attempt index within the failing provider (R8.1). */
  attempt: number;
  /** Zero-based originating chunk index; write path only (R8.3). */
  chunkIndex?: number;
  /** Human-readable description of the failure reason. */
  message: string;
}

/**
 * A structured record emitted once when an embedding request fails terminally,
 * i.e. after exhausting all retries on the Primary_Provider and any configured
 * Fallback_Provider without success (R8.4).
 *
 * `providersAttempted` lists exactly the providers that were tried, and
 * `totalAttempts` is the sum of attempts made across all of them.
 */
export interface TerminalFailureLog {
  /** Every Embedding_Provider attempted, in order (R8.4). */
  providersAttempted: string[];
  /** Total number of attempts made across all providers (R8.4). */
  totalAttempts: number;
  /** The category of the final, terminal failure. */
  finalCategory: FailureCategory;
  /** The message describing the terminal failure reason. */
  finalMessage: string;
}

/**
 * A structured record emitted when the Fallback_Provider, rather than the
 * Primary_Provider, successfully served a request (R5.4). This is the
 * observable indication that the fallback path was used.
 */
export interface FallbackServedLog {
  /** The Primary_Provider that was exhausted before falling back. */
  primaryId: string;
  /** The Fallback_Provider that served the request. */
  fallbackId: string;
}

/**
 * Injectable observability sink for the Embedding_Service.
 *
 * The service depends only on this interface, so tests can assert on the exact
 * records emitted and production can route them to the console (or any other
 * sink) without changing the service logic.
 */
export interface EmbeddingLogger {
  /** Record a single failed attempt (R8.1, R8.2, R8.3). */
  logFailure(log: EmbeddingFailureLog): void;
  /** Record a terminal failure across all providers (R8.4). */
  logTerminal(log: TerminalFailureLog): void;
  /** Record that the Fallback_Provider served a request (R5.4). */
  logFallbackServed(log: FallbackServedLog): void;
}

/**
 * Default {@link EmbeddingLogger} that writes structured records to the console.
 *
 * Each record is emitted as a single structured object so it can be picked up
 * by log aggregation. Per-attempt failures are warnings (they may be retried),
 * while terminal failures are errors. The fallback-served record is informational.
 */
export const consoleEmbeddingLogger: EmbeddingLogger = {
  logFailure(log: EmbeddingFailureLog): void {
    console.warn("[embedding] attempt failed", log);
  },
  logTerminal(log: TerminalFailureLog): void {
    console.error("[embedding] terminal failure", log);
  },
  logFallbackServed(log: FallbackServedLog): void {
    console.info("[embedding] fallback served request", log);
  },
};
