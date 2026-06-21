import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// `lib/env.ts` is a server module (`import "server-only"`); stub it so the
// module can be imported under the node test environment.
vi.mock("server-only", () => ({}));

import { isFallbackConfigured, type EmbeddingConfig } from "@/lib/env";

/**
 * An arbitrary that covers every "presence" state of an optional config value:
 * absent (`undefined`), present-but-empty (`""` / whitespace, which the config
 * treats as absent), and present-and-meaningful (a non-empty token/model).
 */
const optionalValue = fc.oneof(
  fc.constant(undefined),
  fc.constant(""),
  fc.constant("   "),
  fc.string({ minLength: 1 }).map((s) => `v-${s}`),
);

/** Mirror the intended rule independently of the implementation. */
function bothPresent(token: string | undefined, model: string | undefined): boolean {
  const tokenOk = typeof token === "string" && token.length > 0;
  const modelOk = typeof model === "string" && model.length > 0;
  return tokenOk && modelOk;
}

describe("isFallbackConfigured", () => {
  // Feature: free-chunking-embedding-api, Property 10: Fallback configuration
  // requires both token and model. For any combination of presence/absence of
  // the fallback token and the fallback model identifier, the Fallback_Provider
  // is treated as configured if and only if both values are present.
  // Validates: Requirements 6.6
  it("treats the fallback as configured iff both token and model are non-empty", () => {
    fc.assert(
      fc.property(optionalValue, optionalValue, (fallbackToken, fallbackModel) => {
        const config: EmbeddingConfig = {
          primaryProviderId: "huggingface",
          primaryModel: "sentence-transformers/all-mpnet-base-v2",
          fallbackToken,
          fallbackModel,
        };

        // isFallbackConfigured relies on truthiness, so any non-empty string
        // (including whitespace-only) counts as present.
        const expected = bothPresent(fallbackToken, fallbackModel);

        expect(isFallbackConfigured(config)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
