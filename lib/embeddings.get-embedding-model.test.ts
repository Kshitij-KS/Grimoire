import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `lib/embeddings.ts` (transitively via `lib/env.ts`) imports `server-only`,
// which throws outside a server bundle. Stub it so the module can be imported
// under the node test environment.
vi.mock("server-only", () => ({}));

import { getEmbeddingModel } from "@/lib/embeddings";
import { getEmbeddingConfig } from "@/lib/env";

/**
 * Unit tests for the deterministic `getEmbeddingModel()` public surface in
 * `lib/embeddings.ts`.
 *
 * `getEmbeddingModel()` returns the active embedding model identifier as a
 * stable `"<provider>:<model>"` string. Both the Lore_Pipeline (write path)
 * and the Query_Path (read path) report the same identifier through this single
 * function, so it can be used to assert read/write embedding consistency.
 *
 * Covers:
 * - Deterministic identifier: repeated calls return the same string (R1.4).
 * - The identifier the write path reports equals the one the read path reports
 *   because both call this single function (R1.4, R7.1).
 * - The identifier matches the resolved config's `"<primaryProviderId>:<primaryModel>"`
 *   shape (R7.1).
 */
describe("getEmbeddingModel", () => {
  // Snapshot the env keys that influence config resolution so other tests are
  // unaffected, and pin them to deterministic values within this suite.
  const TOUCHED_KEYS = [
    "HF_TOKEN",
    "EMBEDDING_FALLBACK_TOKEN",
    "EMBEDDING_FALLBACK_MODEL",
    "GEMINI_API_KEY",
  ] as const;

  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of TOUCHED_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of TOUCHED_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("returns a stable string across multiple calls (R1.4)", () => {
    const first = getEmbeddingModel();
    const second = getEmbeddingModel();
    const third = getEmbeddingModel();

    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("is unaffected by optional token env vars (the model identifier is stable) (R1.4)", () => {
    const baseline = getEmbeddingModel();

    // Optional credentials must not change the reported model identifier.
    process.env.HF_TOKEN = "hf_some_token";
    process.env.EMBEDDING_FALLBACK_TOKEN = "fallback_token";
    process.env.EMBEDDING_FALLBACK_MODEL = "fallback/model";

    expect(getEmbeddingModel()).toBe(baseline);
  });

  it("matches the resolved config's <primaryProviderId>:<primaryModel> shape (R7.1)", () => {
    const config = getEmbeddingConfig();
    const expected = `${config.primaryProviderId}:${config.primaryModel}`;

    expect(getEmbeddingModel()).toBe(expected);
  });

  it("reports a colon-delimited identifier whose parts equal the resolved config (R7.1)", () => {
    const config = getEmbeddingConfig();
    const identifier = getEmbeddingModel();

    // Exactly one colon separates the provider id from the model identifier.
    const separatorIndex = identifier.indexOf(":");
    expect(separatorIndex).toBeGreaterThan(0);

    const providerId = identifier.slice(0, separatorIndex);
    const model = identifier.slice(separatorIndex + 1);

    expect(providerId).toBe(config.primaryProviderId);
    expect(model).toBe(config.primaryModel);
    expect(model.length).toBeGreaterThan(0);
  });

  it("reports the same identifier on the read path and the write path (R1.4, R7.1)", () => {
    // Both the Lore_Pipeline (write) and the Query_Path (read) obtain the active
    // model identifier through this single function. Simulate each path calling
    // it independently and assert they agree — the property the read/write
    // consistency guard relies on.
    const writePathIdentifier = getEmbeddingModel();
    const readPathIdentifier = getEmbeddingModel();

    expect(readPathIdentifier).toBe(writePathIdentifier);
  });
});
