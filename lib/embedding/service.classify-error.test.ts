// Feature: free-chunking-embedding-api, Property 12: Failure classification is
// total and rate-limit is distinct.
//
// For any error raised during an embedding attempt, the recorded failure
// category is exactly one of {rate-limit, dimension-mismatch, invalid-input,
// unrecognized-response, other}; every Rate_Limit_Error (429/503 status code or
// textual signal) maps to `rate-limit`, and no non rate-limit error maps to
// `rate-limit`. An existing EmbeddingError preserves its category.
//
// Validates: Requirements 8.1, 8.2

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { classifyError } from "./service";
import { EmbeddingError, type FailureCategory } from "./errors";

const ALL_CATEGORIES: readonly FailureCategory[] = [
  "rate-limit",
  "dimension-mismatch",
  "invalid-input",
  "unrecognized-response",
  "other",
];

const categoryArb = fc.constantFrom<FailureCategory>(...ALL_CATEGORIES);

// An existing EmbeddingError carrying any of the five categories.
const embeddingErrorArb = fc
  .tuple(fc.string(), categoryArb)
  .map(([message, category]) => new EmbeddingError(message, { category }));

// Rate-limit signals: a 429/503 status code surfaced on any of the probed
// shapes, or a textual rate-limit marker in an Error message / bare string.
const rateLimitCodeArb = fc.constantFrom(429, 503);

const rateLimitStatusObjectArb = fc.oneof(
  rateLimitCodeArb.map((code) => ({ status: code })),
  rateLimitCodeArb.map((code) => ({ statusCode: code })),
  rateLimitCodeArb.map((code) => ({ response: { status: code } })),
  rateLimitCodeArb.map((code) => ({ httpResponse: { status: code } }))
);

const rateLimitPhraseArb = fc.constantFrom(
  "429 Too Many Requests",
  "HTTP 503 Service Unavailable",
  "rate limit exceeded",
  "rate-limit hit, retry later",
  "Too Many Requests",
  "Service Unavailable",
  "Error 429 from provider",
  "provider returned 503"
);

const rateLimitSignalArb = fc.oneof(
  rateLimitStatusObjectArb,
  rateLimitPhraseArb.map((message) => new Error(message)),
  rateLimitPhraseArb // bare string
);

// Non-signal inputs that must NEVER classify as rate-limit. Status codes are
// drawn from a set that excludes 429/503, messages contain no rate-limit
// markers, and primitives carry no status at all.
const safeStatusArb = fc.constantFrom(200, 201, 301, 302, 400, 401, 403, 404, 418, 500, 502, 504);
const safeMessageArb = fc.constantFrom(
  "network error",
  "timeout occurred",
  "connection reset",
  "unexpected token in response",
  "parse failure",
  "internal failure",
  "boom",
  ""
);

const nonSignalArb = fc.oneof(
  safeStatusArb.map((code) => ({ status: code })),
  safeStatusArb.map((code) => ({ statusCode: code })),
  safeStatusArb.map((code) => ({ response: { status: code } })),
  safeMessageArb.map((message) => new Error(message)),
  safeMessageArb, // bare safe string
  fc.constantFrom(null, undefined, true, false, 42, NaN, {} as unknown)
);

describe("classifyError (Property 12: total classification, distinct rate-limit)", () => {
  // Totality: ANY input maps to exactly one of the five categories.
  it("returns exactly one of the five failure categories for any input", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.anything(),
          embeddingErrorArb,
          rateLimitSignalArb,
          nonSignalArb
        ),
        (input) => {
          const category = classifyError(input);
          expect(ALL_CATEGORIES).toContain(category);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Rate-limit signals (429/503 status or textual marker) always map to rate-limit.
  it("maps every 429/503 status or rate-limit message to `rate-limit`", () => {
    fc.assert(
      fc.property(rateLimitSignalArb, (input) => {
        expect(classifyError(input)).toBe("rate-limit");
      }),
      { numRuns: 100 }
    );
  });

  // Distinctness: inputs without a rate-limit signal never map to rate-limit.
  it("never maps a non rate-limit error to `rate-limit`", () => {
    fc.assert(
      fc.property(nonSignalArb, (input) => {
        expect(classifyError(input)).not.toBe("rate-limit");
      }),
      { numRuns: 100 }
    );
  });

  // An existing EmbeddingError preserves its already-assigned category.
  it("preserves the category of an existing EmbeddingError", () => {
    fc.assert(
      fc.property(fc.string(), categoryArb, (message, category) => {
        const err = new EmbeddingError(message, { category });
        expect(classifyError(err)).toBe(category);
      }),
      { numRuns: 100 }
    );
  });
});
