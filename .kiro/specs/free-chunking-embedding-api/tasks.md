# Implementation Plan: Free Chunking Embedding API

## Overview

This plan hardens Grimoire's embedding provider behind the stable `embedText(text)`
contract. Implementation is in **TypeScript** and tested with **vitest** plus
**fast-check** (property-based tests). Work proceeds bottom-up: configuration and
pure helpers first (most testable in isolation), then the provider abstraction,
then the retry/fallback orchestration, then the public surface, and finally the
read/write consumer wiring. Each step builds on the previous one and ends by
wiring the hardened service into the live call sites so no code is left orphaned.

All embeddings stay at 768 dimensions, so the existing Supabase `vector(768)`
columns, ivfflat indexes, and RPCs require no migration and no re-embedding.

## Tasks

- [x] 1. Set up testing dependency and embedding module structure
  - [x] 1.1 Add `fast-check` and scaffold the embedding module directory
    - Add `fast-check` as a dev dependency (vitest is already present)
    - Create `lib/embedding/` directory for the new provider and service modules
    - Confirm `vitest run` executes and picks up `*.test.ts` files under `lib/`
    - _Requirements: 1.4_

- [x] 2. Implement configuration and the error taxonomy
  - [x] 2.1 Add embedding configuration and named constants
    - Add `EmbeddingConfig` resolution in `lib/env.ts`: `primaryProviderId`,
      `primaryModel` (`sentence-transformers/all-mpnet-base-v2`), optional
      `primaryToken` (`HF_TOKEN`), optional `fallbackToken`
      (`EMBEDDING_FALLBACK_TOKEN`), optional `fallbackModel`
      (`EMBEDDING_FALLBACK_MODEL`)
    - Treat the fallback as configured only when BOTH `fallbackToken` and
      `fallbackModel` are non-empty
    - Define `REQUIRED_DIMENSION = 768`, `MAX_RETRIES = 5`,
      `BACKOFF_START_MS = 1000`, `BACKOFF_CAP_MS = 60_000`,
      `REQUEST_TIMEOUT_MS = 30_000`, `MAX_INPUT_CHARS = 8192` constants
    - Fail initialization with a missing-config error when provider id or model
      identifier is absent
    - _Requirements: 1.5, 1.8, 6.1, 6.5, 6.6_

  - [x] 2.2 Implement the `EmbeddingError` type and `FailureCategory` enum
    - Create `EmbeddingError extends Error` with `category`, optional
      `actualDimension`, `expectedDimension`, `providersAttempted`
    - Define `FailureCategory = "rate-limit" | "dimension-mismatch" | "invalid-input" | "unrecognized-response" | "other"`
    - _Requirements: 8.1_

  - [x]* 2.3 Write property test for fallback configuration gating
    - **Property 10: Fallback configuration requires both token and model**
    - **Validates: Requirements 6.6**

  - [x]* 2.4 Write unit tests for config presence and missing-config init error
    - Cover missing provider/model init error, optional token resolution, and
      `GEMINI_API_KEY` absence not blocking initialization
    - _Requirements: 1.5, 1.8, 6.1, 6.5, 6.7_

- [x] 3. Implement pure service helpers in `lib/embedding/service.ts`
  - [x] 3.1 Implement `validateInput(text)`
    - Reject empty/whitespace-only input before any provider call
    - Reject input longer than 8192 chars, naming the length and the 8192 max
    - _Requirements: 2.4, 2.5, 7.5_

  - [x]* 3.2 Write property test for whitespace/empty rejection
    - **Property 3: Empty or whitespace-only input is rejected without calling the provider**
    - **Validates: Requirements 2.4, 7.5**

  - [x]* 3.3 Write property test for over-length rejection
    - **Property 4: Over-length input is rejected without calling the provider**
    - **Validates: Requirements 2.5**

  - [x] 3.4 Implement `backoffDelayMs(attempt)`
    - Return `min(2^(attempt-1) * 1000, 60000)` milliseconds
    - _Requirements: 4.2_

  - [x]* 3.5 Write property test for backoff schedule
    - **Property 6: Backoff is exponential, starts at 1s, doubles, and is capped at 60s**
    - **Validates: Requirements 4.2**

  - [x] 3.6 Implement `validateDimension(vec)`
    - Return the vector when length is exactly 768
    - Throw a `dimension-mismatch` `EmbeddingError` naming actual length and 768
      otherwise; never return a non-768 vector
    - _Requirements: 1.6, 2.2, 7.4_

  - [x]* 3.7 Write property test for dimension rejection
    - **Property 2: Dimension mismatch is always rejected**
    - **Validates: Requirements 1.3, 1.6, 2.2, 5.2, 7.4**

  - [x] 3.8 Implement `classifyError(err)`
    - Map any error to exactly one `FailureCategory`; map 429/503 retry signals to
      `rate-limit` and nothing else to `rate-limit`
    - _Requirements: 8.1, 8.2_

  - [x]* 3.9 Write property test for total, distinct failure classification
    - **Property 12: Failure classification is total and rate-limit is distinct**
    - **Validates: Requirements 8.1, 8.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the provider abstraction in `lib/embedding/provider.ts`
  - [x] 5.1 Define the `EmbeddingProvider` interface and `HuggingFaceProvider`
    - Define `EmbeddingProvider` with `id`, `model`, `allowsAnonymous`, and
      `embed(text, signal): Promise<number[]>`
    - Port `HfInference.featureExtraction` logic from `lib/gemini.ts`, normalizing
      `number[] | number[][]` output; throw `unrecognized-response` on other shapes
    - Attach `HF_TOKEN` as auth credentials when present; allow anonymous when absent
    - _Requirements: 2.3, 6.2, 6.3, 6.4_

  - [x] 5.2 Construct the `FallbackProvider` (config-gated)
    - Build a `FallbackProvider` instance only when both fallback token and model
      are configured; otherwise expose it as unavailable
    - Reject a fallback whose model emits a non-768 vector as a valid fallback
    - _Requirements: 5.2, 6.5, 6.6_

  - [x]* 5.3 Write property test for unrecognized provider responses
    - **Property 5: Unrecognized provider responses are rejected**
    - **Validates: Requirements 2.3**

  - [x]* 5.4 Write property test for primary token attachment
    - **Property 11: Primary token is attached to every primary request when present**
    - **Validates: Requirements 6.2**

  - [x]* 5.5 Write unit tests for anonymous and missing-token-disallowed paths
    - Anonymous request issued without credentials when token absent and allowed
    - Config error raised before any request when token absent and anonymous disallowed
    - _Requirements: 6.3, 6.4_

- [x] 6. Implement retry/backoff and fallback orchestration in `lib/embedding/service.ts`
  - [x] 6.1 Implement `callWithRetry(provider, text)`
    - Drive up to 6 total invocations (initial + 5 retries) with `backoffDelayMs`
    - Apply a 30s per-request timeout via `AbortSignal`; treat timeout/network as
      retryable `other`, dimension/input errors as terminal
    - On retryable exhaustion, raise an error naming the final failure reason;
      stop immediately on first success
    - _Requirements: 2.6, 4.1, 4.3, 4.4, 4.5_

  - [x]* 6.2 Write property test for persistent rate-limit exhaustion
    - **Property 7: Persistent rate-limiting retries exactly five times then fails terminally**
    - **Validates: Requirements 4.1, 4.3**

  - [x]* 6.3 Write property test for early-success retry behavior
    - **Property 8: A retry that succeeds returns the vector and consumes no further attempts**
    - **Validates: Requirements 4.4, 4.5**

  - [x] 6.4 Implement `embedText(text)` with validation, fallback, and logging
    - Compose `validateInput` → `callWithRetry(primary)` → `validateDimension`
    - On primary exhaustion route to the fallback when configured, else raise the
      primary's final error; on both exhausted raise a combined error naming both
      providers and the final reason
    - Emit structured `EmbeddingFailureLog` per failed attempt and a
      `TerminalFailureLog` listing every provider attempted and total attempts;
      record an observable indication when the fallback served the request
    - _Requirements: 1.6, 1.7, 2.1, 5.1, 5.3, 5.4, 5.5, 5.6, 8.3, 8.4_

  - [x]* 6.5 Write property test for valid-text success
    - **Property 1: Valid text yields a 768-element numeric vector**
    - **Validates: Requirements 1.2, 2.1, 7.3**

  - [x]* 6.6 Write property test for fallback serving on primary exhaustion
    - **Property 9: Configured fallback serves when the primary is exhausted**
    - **Validates: Requirements 5.1, 5.4, 5.5**

  - [x]* 6.7 Write property test for terminal failure logging
    - **Property 13: Terminal failure log names every provider attempted and the total attempt count**
    - **Validates: Requirements 8.4**

  - [x]* 6.8 Write unit tests for fallback exhaustion and 30s timeout
    - No-fallback exhaustion raises primary final error; both-fail raises combined
      error; 30s timeout (fake timers) yields provider-failed error, no vector
    - _Requirements: 2.6, 5.3, 5.6_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Wire the public surface in `lib/embeddings.ts`
  - [x] 8.1 Expose `embedText` and `getEmbeddingModel` from the hardened service
    - Re-export `embedText` from `lib/embedding/service.ts` preserving the
      `(text: string): Promise<number[]>` signature
    - Implement `getEmbeddingModel()` returning the active provider+model identifier
    - _Requirements: 1.4, 7.1_

  - [x] 8.2 Implement the model-consistency guard for the Query_Path
    - Provide a guard that compares the active model identifier to the recorded
      stored model identifier and raises a naming error (suppressing RPCs) on mismatch
    - _Requirements: 7.2_

  - [x]* 8.3 Write property test for the model-consistency guard
    - **Property 14: Model-consistency guard suppresses RPCs on mismatch**
    - **Validates: Requirements 7.2**

  - [x]* 8.4 Write unit test for deterministic `getEmbeddingModel`
    - Same identifier reported across read and write paths
    - _Requirements: 1.4, 7.1_

- [x] 9. Wire the write path in `lib/lore-processing.ts` and `lib/inngest/lore-ingest.ts`
  - [x] 9.1 Reduce `embedWithRetry` to a thin `embedText` pass-through
    - Remove the local 3-attempt fixed-backoff retry; let the service own retries
    - Propagate terminal errors so the per-chunk loop aborts that entry's write
      without leaving partially-written vectors
    - _Requirements: 1.7, 3.1, 3.3_

  - [x] 9.2 Extend the `failed_jobs` record written by the Inngest `onFailure` handler
    - Include zero-based `chunk_index`, `category`, and the final `error_message`
    - Confirm successful completion sets `processing_status = complete` and terminal
      failure transitions the entry to `failed`
    - _Requirements: 3.4, 3.5, 8.3_

  - [x]* 9.3 Write property test for batch chunk-count preservation
    - **Property 15: Batch storage preserves total chunk count**
    - **Validates: Requirements 3.1**

  - [x]* 9.4 Write property test for per-entry failure isolation
    - **Property 16: One failed entry does not abort the batch**
    - **Validates: Requirements 3.6**

  - [x]* 9.5 Write unit tests for status transitions and failed_jobs contents
    - Success → `complete`; terminal failure → `failed` with chunk index, category,
      and message recorded
    - _Requirements: 3.3, 3.4, 3.5, 8.3_

- [x] 10. Wire the Query_Path routes to the hardened service
  - [x] 10.1 Apply the model-consistency guard before similarity RPCs in all read routes
    - Update `app/api/lore/search`, `app/api/tavern`, `app/api/souls/chat`,
      `app/api/narrator`, and `app/api/consistency/check` to call the hardened
      `embedText` and run the guard before `match_lore_chunks` / `match_semantic_cache`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11. Remove dead Gemini dependency and stale comments
  - [x] 11.1 Remove `GEMINI_API_KEY` from the embedding init path and fix stale model comments
    - Ensure initialization and embedding succeed with no `GEMINI_API_KEY` present
    - Replace stale `BAAI/bge-base-en-v1.5` comments in `lib/gemini.ts` and
      `lib/embeddings.ts` with the actual `all-mpnet-base-v2` source of truth
    - _Requirements: 6.7_

  - [x]* 11.2 Write unit test confirming init/embed succeed without `GEMINI_API_KEY`
    - _Requirements: 6.7_

- [x] 12. Integration and smoke testing
  - [x]* 12.1 Write integration / smoke tests
    - Recorded/live HuggingFace call returning a real 768-dim vector (provider
      reachability and free-tier selection)
    - Request pacing at or below the documented free-tier rate so frequency alone
      does not trip throttling
    - End-to-end: five Lore_Entries ingested with stored chunk count equal to
      produced chunk count
    - _Requirements: 1.1, 3.1, 3.2_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Implementation language is **TypeScript**; tests use **vitest** + **fast-check**.
- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP,
  but each property test maps to a specific correctness property from the design.
- Each property-based test runs a minimum of 100 iterations
  (`fc.assert(..., { numRuns: 100 })`) and is tagged with a comment referencing its
  design property number.
- All 16 correctness properties are covered by tasks 2.3, 3.2, 3.3, 3.5, 3.7, 3.9,
  5.3, 5.4, 6.2, 6.3, 6.5, 6.6, 6.7, 8.3, 9.3, and 9.4.
- Embeddings remain 768-dimensional; no database migration or re-embedding is
  required.
- Checkpoints ensure incremental validation at natural boundaries.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "2.4", "3.1", "3.4", "3.6", "3.8"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.5", "3.7", "3.9", "5.1", "5.2"] },
    { "id": 3, "tasks": ["5.3", "5.4", "5.5", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["6.5", "6.6", "6.7", "6.8", "8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "8.4", "9.1", "9.2", "10.1", "11.1"] },
    { "id": 7, "tasks": ["9.3", "9.4", "9.5", "11.2", "12.1"] }
  ]
}
```
