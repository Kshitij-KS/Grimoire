// Feature: free-chunking-embedding-api
// Error taxonomy for the hardened Embedding_Service.
//
// All embedding failures surface as `EmbeddingError` carrying a `category`
// field, so callers and observability share a single taxonomy (see design.md
// "Error Handling"). The `FailureCategory` union is the exact, closed set of
// categories required by Requirement 8.1.

/**
 * The exact, closed set of embedding failure categories.
 *
 * Exactly one of these is recorded for every embedding failure (R8.1):
 * - `rate-limit`: provider throttling / quota (e.g. HTTP 429 or 503 retry signal)
 * - `dimension-mismatch`: provider returned a vector whose length is not 768
 * - `invalid-input`: empty/whitespace-only or over-length input
 * - `unrecognized-response`: provider response did not match the expected shape
 * - `other`: timeout, network, configuration, or any unclassified failure
 */
export type FailureCategory =
  | "rate-limit"
  | "dimension-mismatch"
  | "invalid-input"
  | "unrecognized-response"
  | "other";

/**
 * Options used to construct an {@link EmbeddingError}.
 */
export interface EmbeddingErrorOptions {
  /** The failure category. Exactly one of the {@link FailureCategory} values. */
  category: FailureCategory;
  /** Actual vector length, set for `dimension-mismatch` failures (R2.2, R7.4). */
  actualDimension?: number;
  /** Expected vector length (768) for dimension-related failures. */
  expectedDimension?: number;
  /** Every provider attempted, set on terminal failures (R8.4). */
  providersAttempted?: string[];
  /** Optional underlying error that triggered this failure. */
  cause?: unknown;
}

/**
 * Error raised by the Embedding_Service for any embedding failure.
 *
 * Carries a `category` so callers and the observability layer share one
 * taxonomy. Dimension-related failures additionally carry the actual and
 * expected element counts; terminal failures carry the list of providers
 * attempted.
 */
export class EmbeddingError extends Error {
  /** The failure category. Exactly one {@link FailureCategory} value. */
  readonly category: FailureCategory;
  /** Actual vector length for `dimension-mismatch` failures. */
  readonly actualDimension?: number;
  /** Expected vector length (768) for dimension-related failures. */
  readonly expectedDimension?: number;
  /** Every provider attempted, for terminal failures. */
  readonly providersAttempted?: string[];

  constructor(message: string, options: EmbeddingErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "EmbeddingError";
    this.category = options.category;
    this.actualDimension = options.actualDimension;
    this.expectedDimension = options.expectedDimension;
    this.providersAttempted = options.providersAttempted;

    // Restore prototype chain for instanceof checks when targeting ES5/ES2015.
    Object.setPrototypeOf(this, EmbeddingError.prototype);
  }
}
