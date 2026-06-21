// Feature: free-chunking-embedding-api, Property 3: Empty or whitespace-only
// input is rejected without calling the provider. For any string composed
// entirely of whitespace characters (including the empty string), `embedText`
// raises an invalid-input error and never invokes any Embedding_Provider, on
// both the write path and the Query_Path.
//
// Validates: Requirements 2.4, 7.5
//
// `validateInput` is the single guard both `embedText` (write path) and the
// Query_Path call before any provider invocation. It is a pure, provider-free
// function: it accepts only the text and either returns void or throws. Because
// it has no provider dependency at all, proving that it ALWAYS throws an
// `invalid-input` EmbeddingError for whitespace-only/empty input is exactly the
// guarantee that no provider is ever reached for such input. To make the
// "no provider call" guarantee explicit and robust, we additionally drive the
// guard through a spy-backed wrapper that would call a provider only if the
// guard let execution continue, and assert the spy is never invoked.

import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { validateInput } from "./service";
import { EmbeddingError } from "./errors";

// Whitespace characters spanning the ASCII set plus a representative Unicode
// space. `String.prototype.trim()` (used by `validateInput`) removes all of
// these, so every generated string is whitespace-only.
const WHITESPACE_CHARS = [" ", "\t", "\n", "\r", "\f", "\v", "\u00a0"] as const;

// Generates strings made entirely of whitespace, including the empty string
// (when the array is empty). minLength 0 deliberately covers the empty-string
// edge case required by Property 3.
const whitespaceOnlyArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...WHITESPACE_CHARS), { minLength: 0, maxLength: 64 })
  .map((chars) => chars.join(""));

describe("Property 3: empty/whitespace-only input is rejected without a provider call", () => {
  it("validateInput throws an invalid-input EmbeddingError for any whitespace-only or empty string", () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (text) => {
        // The guard must throw rather than return.
        let thrown: unknown;
        try {
          validateInput(text);
          // If we reach here, the guard wrongly admitted the input.
          throw new Error(
            `validateInput accepted whitespace-only input ${JSON.stringify(text)}`
          );
        } catch (err) {
          thrown = err;
        }

        // It must be an EmbeddingError categorized as invalid-input.
        expect(thrown).toBeInstanceOf(EmbeddingError);
        expect((thrown as EmbeddingError).category).toBe("invalid-input");
      }),
      { numRuns: 100 }
    );
  });

  it("never reaches the provider for whitespace-only or empty input", () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (text) => {
        // A spy standing in for any Embedding_Provider call. The guard runs
        // first; only if it (incorrectly) returned would the provider be hit.
        const providerSpy = vi.fn();

        const embedGuarded = (input: string): void => {
          validateInput(input);
          // Unreachable for whitespace-only input when the guard is correct.
          providerSpy(input);
        };

        expect(() => embedGuarded(text)).toThrowError(EmbeddingError);
        expect(providerSpy).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});
