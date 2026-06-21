/**
 * Named constants for the hardened Embedding_Service.
 *
 * These values are the single source of truth for the embedding subsystem's
 * dimension constraint, retry policy, backoff schedule, per-request timeout,
 * and input bounds. They are intentionally kept free of any `server-only`
 * import so they can be consumed by both the service and its tests.
 */

/**
 * The fixed embedding vector length the database expects. The Supabase
 * pgvector columns (`lore_chunks.embedding`, `semantic_cache.embedding`) are
 * `vector(768)`, so any vector of a different length is rejected.
 */
export const REQUIRED_DIMENSION = 768;

/**
 * Maximum number of retry attempts after the initial request. With the initial
 * invocation this allows up to 6 total attempts per provider.
 */
export const MAX_RETRIES = 5;

/** Initial backoff interval (1 second) before the first retry. */
export const BACKOFF_START_MS = 1000;

/** Maximum backoff interval (60 seconds) applied per retry. */
export const BACKOFF_CAP_MS = 60_000;

/** Per-request timeout (30 seconds) applied to each provider invocation. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum number of input characters accepted by `embedText`. */
export const MAX_INPUT_CHARS = 8192;
