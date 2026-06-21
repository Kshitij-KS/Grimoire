// Feature: free-chunking-embedding-api, Property 14: Model-consistency guard
// suppresses RPCs on mismatch.
//
// For any pair of (active model identifier, recorded stored model identifier),
// the Query_Path proceeds to issue the similarity-search RPC if and only if the
// two identifiers are equal; when they differ, assertModelConsistency raises an
// EmbeddingError naming BOTH the active and stored identifiers and issues no
// RPC. To verify "suppresses the RPC", a spy callback that stands in for the
// similarity RPC is invoked only after the guard returns: it must run on a
// match and must NOT run on a mismatch.
//
// Validates: Requirements 7.2

import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// `lib/embeddings.ts` (transitively via `lib/env.ts`) imports `server-only`,
// which throws outside a server bundle. Stub it so the module can be imported
// under the node test environment.
vi.mock("server-only", () => ({}));

import { assertModelConsistency } from "@/lib/embeddings";
import { EmbeddingError } from "@/lib/embedding/errors";

// Arbitrary, realistic-ish model identifiers in the "<provider>:<model>" shape
// the guard compares, plus some free-form strings to widen the input space.
const modelIdArb = fc.oneof(
  fc.string(),
  fc.constantFrom(
    "huggingface:sentence-transformers/all-mpnet-base-v2",
    "huggingface:BAAI/bge-base-en-v1.5",
    "openai:text-embedding-3-small",
    "cohere:embed-english-v3.0",
    "",
  ),
  fc
    .tuple(
      fc.constantFrom("huggingface", "openai", "cohere", "voyage"),
      fc.string({ minLength: 1, maxLength: 40 }),
    )
    .map(([provider, model]) => `${provider}:${model}`),
);

/**
 * Run the guard and then a spy callback standing in for the similarity RPC.
 * The spy is only reached when the guard returns normally, mirroring the
 * Query_Path: `assertModelConsistency(...)` then `match_lore_chunks(...)`.
 */
function runGuardThenRpc(
  active: string,
  stored: string,
): { threw: boolean; error: unknown; rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn();
  let threw = false;
  let error: unknown;
  try {
    assertModelConsistency(stored, active);
    // Only invoked after the guard returns — the suppressible RPC.
    rpc();
  } catch (err) {
    threw = true;
    error = err;
  }
  return { threw, error, rpc };
}

describe("assertModelConsistency (Property 14: guard suppresses RPCs on mismatch)", () => {
  it("returns normally and lets the RPC fire when identifiers match", () => {
    const { threw, rpc } = runGuardThenRpc(
      "huggingface:sentence-transformers/all-mpnet-base-v2",
      "huggingface:sentence-transformers/all-mpnet-base-v2",
    );
    expect(threw).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("throws an EmbeddingError naming both identifiers and suppresses the RPC on mismatch", () => {
    const active = "huggingface:sentence-transformers/all-mpnet-base-v2";
    const stored = "huggingface:BAAI/bge-base-en-v1.5";
    const { threw, error, rpc } = runGuardThenRpc(active, stored);
    expect(threw).toBe(true);
    expect(error).toBeInstanceOf(EmbeddingError);
    expect((error as EmbeddingError).message).toContain(active);
    expect((error as EmbeddingError).message).toContain(stored);
    expect(rpc).not.toHaveBeenCalled();
  });

  // Property 14: for arbitrary (active, stored) pairs, the guard throws an
  // EmbeddingError iff active !== stored; on mismatch the message names both
  // identifiers and the RPC is suppressed; on match the RPC fires exactly once.
  it("issues the RPC iff active === stored, naming both ids on mismatch", () => {
    fc.assert(
      fc.property(modelIdArb, modelIdArb, (active, stored) => {
        const { threw, error, rpc } = runGuardThenRpc(active, stored);

        if (active === stored) {
          // Equal identifiers: guard returns, RPC proceeds exactly once.
          expect(threw).toBe(false);
          expect(rpc).toHaveBeenCalledTimes(1);
        } else {
          // Differing identifiers: guard throws a typed error and the RPC is
          // never reached.
          expect(threw).toBe(true);
          expect(error).toBeInstanceOf(EmbeddingError);
          const embErr = error as EmbeddingError;
          // The thrown message names BOTH the active and stored identifiers.
          // Empty-string identifiers are vacuously contained, which is fine:
          // a non-empty counterpart is still named.
          expect(embErr.message).toContain(active);
          expect(embErr.message).toContain(stored);
          expect(rpc).not.toHaveBeenCalled();
        }
      }),
      { numRuns: 100 },
    );
  });

  // Complementary half: any single identifier compared against itself always
  // permits the RPC and never throws.
  it("always permits the RPC when an identifier is compared against itself", () => {
    fc.assert(
      fc.property(modelIdArb, (id) => {
        const { threw, rpc } = runGuardThenRpc(id, id);
        expect(threw).toBe(false);
        expect(rpc).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 },
    );
  });
});
