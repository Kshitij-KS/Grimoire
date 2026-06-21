// Feature: free-chunking-embedding-api, Property 4: Over-length input is
// rejected without calling the provider. For any string longer than 8192
// characters, `embedText` raises an error that names the input length and the
// maximum of 8192 characters, and never invokes any Embedding_Provider.
//
// Validates: Requirements 2.5
//
// `validateInput` is the pre-call guard inside the Embedding_Service. It takes
// no provider and performs no I/O, so reaching a thrown `invalid-input`
// EmbeddingError structurally guarantees that no Embedding_Provider was
// invoked for over-length input.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { validateInput } from "@/lib/embedding/service";
import { EmbeddingError } from "@/lib/embedding/errors";
import { MAX_INPUT_CHARS } from "@/lib/embedding/constants";

describe("validateInput - over-length rejection (Property 4)", () => {
  it("rejects any string longer than MAX_INPUT_CHARS without calling a provider", () => {
    fc.assert(
      fc.property(
        // Generate a string that always exceeds MAX_INPUT_CHARS (8192) and
        // always contains at least one non-whitespace character, so the
        // whitespace guard passes and execution reaches the length check.
        fc.string().map((s) => {
          const base = `${s}x`; // ensure at least one non-whitespace char
          const needed = MAX_INPUT_CHARS + 1 - base.length;
          return needed > 0 ? base + "x".repeat(needed) : base;
        }),
        (text) => {
          // Precondition sanity: the generated input must be over-length.
          expect(text.length).toBeGreaterThan(MAX_INPUT_CHARS);

          let thrown: unknown;
          try {
            validateInput(text);
          } catch (err) {
            thrown = err;
          }

          // An error must be raised for over-length input.
          expect(thrown).toBeInstanceOf(EmbeddingError);
          const error = thrown as EmbeddingError;

          // The failure is categorized as invalid-input.
          expect(error.category).toBe("invalid-input");

          // The message names both the actual input length and the 8192 max.
          expect(error.message).toContain(String(text.length));
          expect(error.message).toContain(String(MAX_INPUT_CHARS));
        }
      ),
      { numRuns: 100 }
    );
  });
});
