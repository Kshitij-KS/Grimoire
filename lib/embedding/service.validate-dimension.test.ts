// Feature: free-chunking-embedding-api, Property 2: Dimension mismatch is
// always rejected.
//
// For any integer length n != 768, when a provider returns a vector of length
// n, the Embedding_Service raises a dimension-mismatch error that names both
// the actual count n and the expected count 768, returns no vector, persists
// nothing, and (on the Query_Path) does not issue the match_lore_chunks or
// match_semantic_cache RPC. For length exactly 768 it returns the vector
// unchanged.
//
// Validates: Requirements 1.3, 1.6, 2.2, 5.2, 7.4

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { validateDimension } from "./service";
import { EmbeddingError } from "./errors";
import { REQUIRED_DIMENSION } from "./constants";

describe("validateDimension (Property 2: dimension mismatch is always rejected)", () => {
  it("returns a 768-element vector unchanged", () => {
    const vec = Array.from({ length: REQUIRED_DIMENSION }, (_, i) => i * 0.001);
    const result = validateDimension(vec);
    // Same reference returned, contents unchanged.
    expect(result).toBe(vec);
    expect(result).toEqual(vec);
  });

  it("throws a dimension-mismatch EmbeddingError for a too-short vector", () => {
    expect(() => validateDimension([1, 2, 3])).toThrowError(EmbeddingError);
  });

  it("throws a dimension-mismatch EmbeddingError for an empty vector", () => {
    expect(() => validateDimension([])).toThrowError(EmbeddingError);
  });

  // Property 2: for any numeric array whose length is NOT 768, validateDimension
  // throws a dimension-mismatch EmbeddingError carrying the actual length and
  // the expected length of 768, and never returns a vector.
  it("rejects every vector whose length is not 768, naming actual and expected counts", () => {
    fc.assert(
      fc.property(
        // Generate a length n != 768, then build an arbitrary numeric vector of
        // that length. Bound the upper length to keep allocation cheap while
        // exercising lengths on both sides of 768.
        fc
          .integer({ min: 0, max: 2000 })
          .filter((n) => n !== REQUIRED_DIMENSION)
          .chain((n) =>
            fc.array(
              fc.float({ noNaN: true }),
              { minLength: n, maxLength: n }
            )
          ),
        (vec) => {
          let threw = false;
          let returned: number[] | undefined;
          try {
            returned = validateDimension(vec);
          } catch (err) {
            threw = true;
            // Must be a typed EmbeddingError with the dimension-mismatch category.
            expect(err).toBeInstanceOf(EmbeddingError);
            const embErr = err as EmbeddingError;
            expect(embErr.category).toBe("dimension-mismatch");
            // Names both the actual count and the expected count of 768.
            expect(embErr.actualDimension).toBe(vec.length);
            expect(embErr.expectedDimension).toBe(REQUIRED_DIMENSION);
            expect(embErr.message).toContain(String(vec.length));
            expect(embErr.message).toContain(String(REQUIRED_DIMENSION));
          }

          // It always throws and never returns a value for non-768 lengths.
          expect(threw).toBe(true);
          expect(returned).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Complementary half of the property: any vector of exactly 768 elements is
  // returned unchanged, never throwing.
  it("returns any 768-element numeric vector unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ noNaN: true }), {
          minLength: REQUIRED_DIMENSION,
          maxLength: REQUIRED_DIMENSION,
        }),
        (vec) => {
          const result = validateDimension(vec);
          expect(result).toBe(vec);
          expect(result.length).toBe(REQUIRED_DIMENSION);
        }
      ),
      { numRuns: 100 }
    );
  });
});
