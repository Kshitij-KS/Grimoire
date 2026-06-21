// Feature: free-chunking-embedding-api, Property 1: Valid text yields a
// 768-element numeric vector.
//
// For any text containing at least one non-whitespace character and no more
// than 8192 characters, when the provider returns a well-formed result,
// `embedText` returns an EmbeddingVector of exactly 768 numeric elements.
//
// Validates: Requirements 1.2, 2.1, 7.3

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { embedText } from "./service";
import { MAX_INPUT_CHARS, REQUIRED_DIMENSION } from "./constants";
import type { EmbeddingProvider } from "./provider";

/** Build a well-formed success vector of exactly the required dimension. */
function makeVector(): number[] {
  return Array.from({ length: REQUIRED_DIMENSION }, (_, i) => i / REQUIRED_DIMENSION);
}

/**
 * Stub primary provider that returns a valid 768-element vector for any input.
 * Injected via `embedText`'s options so the property runs in-memory with no
 * network call. An explicit `undefined` fallback means "no fallback".
 */
function makeStubPrimary(): EmbeddingProvider {
  return {
    id: "stub:primary-model",
    model: "primary-model",
    allowsAnonymous: true,
    async embed(): Promise<number[]> {
      return makeVector();
    },
  };
}

/**
 * Generator for valid text: at least one non-whitespace character and no more
 * than MAX_INPUT_CHARS (8192) characters. A non-whitespace core is concatenated
 * with arbitrary surrounding text and trimmed to the length bound, guaranteeing
 * `validateInput` accepts it.
 */
const validText = fc
  .tuple(
    // At least one guaranteed non-whitespace character.
    fc.constantFrom("a", "Z", "7", "λ", "字", "!", "_"),
    // Arbitrary additional text (may include whitespace).
    fc.string({ maxLength: MAX_INPUT_CHARS - 1 }),
  )
  .map(([core, rest]) => (core + rest).slice(0, MAX_INPUT_CHARS));

describe("embedText (Property 1: valid text yields a 768-element numeric vector)", () => {
  // Property 1: for any valid text, when the provider returns a well-formed
  // result, embedText returns exactly 768 numeric elements.
  it("returns a 768-element numeric vector for any valid text", async () => {
    await fc.assert(
      fc.asyncProperty(validText, async (text) => {
        const vector = await embedText(text, {
          primary: makeStubPrimary(),
          fallback: undefined,
        });

        // Exactly 768 elements (R1.2, R2.1, R7.3).
        expect(vector).toHaveLength(REQUIRED_DIMENSION);
        // Every element is a finite number.
        expect(vector.every((v) => typeof v === "number" && Number.isFinite(v))).toBe(
          true,
        );
      }),
      { numRuns: 100 },
    );
  });
});
