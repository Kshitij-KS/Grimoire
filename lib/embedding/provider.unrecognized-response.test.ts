// Feature: free-chunking-embedding-api, Property 5: Unrecognized provider
// responses are rejected.
//
// For any provider response that does not match the expected vector structure
// (neither `number[]` nor `number[][]` of numbers), the Embedding_Service
// raises an unrecognized-response error and returns no vector. For a valid
// `number[]` the response is returned as-is, and for a valid `number[][]` the
// first row is returned.
//
// Validates: Requirements 2.3
//
// This exercises `HuggingFaceProvider.embed`, whose only job is to normalize
// the `HfInference.featureExtraction` output shape. We stub the underlying
// HuggingFace client so each generated shape flows through the real
// normalization logic. `provider.ts` statically imports `lib/env.ts`, which
// does `import "server-only"`, so we mock `server-only` to a no-op module to
// let the import resolve under the node test environment.

import { describe, expect, it, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Mutable holder read by the mocked HfInference at call time. Using vi.hoisted
// so it is initialized before the hoisted vi.mock factory runs.
const stub = vi.hoisted(() => ({ response: undefined as unknown }));

vi.mock("server-only", () => ({}));

vi.mock("@huggingface/inference", () => ({
  HfInference: class {
    // Returns whatever the current test iteration placed in the stub. The
    // provider then normalizes this raw shape.
    featureExtraction = async (): Promise<unknown> => stub.response;
  },
}));

import { HuggingFaceProvider } from "./provider";
import { EmbeddingError } from "./errors";

const provider = new HuggingFaceProvider({
  model: "sentence-transformers/all-mpnet-base-v2",
});

function newSignal(): AbortSignal {
  return new AbortController().signal;
}

beforeEach(() => {
  stub.response = undefined;
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// Valid shape A: a non-empty `number[]` (first element is a number) — returned
// as-is by the normalizer.
const numberVectorArb: fc.Arbitrary<number[]> = fc.array(
  fc.float({ noNaN: true }),
  { minLength: 1, maxLength: 32 },
);

// Valid shape B: a `number[][]` whose first row is a non-empty `number[]` — the
// first row is returned by the normalizer.
const numberMatrixArb: fc.Arbitrary<number[][]> = fc
  .tuple(
    fc.array(fc.float({ noNaN: true }), { minLength: 1, maxLength: 16 }),
    fc.array(
      fc.array(fc.float({ noNaN: true }), { minLength: 0, maxLength: 8 }),
      { minLength: 0, maxLength: 4 },
    ),
  )
  .map(([firstRow, rest]) => [firstRow, ...rest]);

// A non-number, non-array scalar usable as a leading element to force rejection.
const nonNumericLeadingArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.object(),
);

// Unrecognized shapes that the normalizer must reject:
const unrecognizedResponseArb: fc.Arbitrary<unknown> = fc.oneof(
  // Non-array primitives / objects.
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.object(),
  fc.record({ embedding: fc.array(fc.float({ noNaN: true })) }),
  // Empty array — fails both the number[] and number[][] checks.
  fc.constant([] as unknown[]),
  // Array whose first element is a non-number, non-array value.
  fc
    .tuple(nonNumericLeadingArb, fc.array(fc.anything(), { maxLength: 4 }))
    .map(([head, tail]) => [head, ...tail]),
  // Array of strings (arrays of non-numbers).
  fc.array(fc.string(), { minLength: 1, maxLength: 8 }),
  // number[][] whose first row's first element is NOT a number (e.g. [["a"]]).
  fc
    .array(fc.string(), { minLength: 1, maxLength: 4 })
    .map((row) => [row]),
  // Empty first row -> [[]] : result[0] is an array but result[0][0] is
  // undefined (not a number).
  fc.constant([[]] as unknown[]),
  // Deeply nested arrays: number[][][] -> result[0][0] is an array, not a number.
  fc
    .array(fc.float({ noNaN: true }), { minLength: 1, maxLength: 4 })
    .map((v) => [[v]]),
);

// ---------------------------------------------------------------------------
// Property 5
// ---------------------------------------------------------------------------

describe("Property 5: unrecognized provider responses are rejected", () => {
  it("rejects every unrecognized response shape with an unrecognized-response EmbeddingError", async () => {
    await fc.assert(
      fc.asyncProperty(unrecognizedResponseArb, async (response) => {
        stub.response = response;

        let thrown: unknown;
        let returned: number[] | undefined;
        try {
          returned = await provider.embed("some text", newSignal());
        } catch (err) {
          thrown = err;
        }

        // Must throw a typed EmbeddingError categorized as unrecognized-response
        // and never return a vector.
        expect(returned).toBeUndefined();
        expect(thrown).toBeInstanceOf(EmbeddingError);
        expect((thrown as EmbeddingError).category).toBe("unrecognized-response");
      }),
      { numRuns: 100 },
    );
  });

  it("returns a valid number[] response unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(numberVectorArb, async (vec) => {
        stub.response = vec;
        const result = await provider.embed("some text", newSignal());
        expect(result).toEqual(vec);
      }),
      { numRuns: 100 },
    );
  });

  it("returns the first row of a valid number[][] response", async () => {
    await fc.assert(
      fc.asyncProperty(numberMatrixArb, async (matrix) => {
        stub.response = matrix;
        const result = await provider.embed("some text", newSignal());
        expect(result).toEqual(matrix[0]);
      }),
      { numRuns: 100 },
    );
  });
});
