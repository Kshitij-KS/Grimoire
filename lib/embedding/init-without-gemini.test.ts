import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `@/lib/env` imports `server-only`, which throws when evaluated outside a
// server bundle. Stub it so the module can be imported under the node test
// environment (mirrors lib/embeddings.get-embedding-model.test.ts).
vi.mock("server-only", () => ({}));

import { getEmbeddingConfig } from "@/lib/env";
import { createPrimaryProvider } from "@/lib/embedding/provider";
import { embedText } from "@/lib/embedding/service";

/**
 * Unit tests confirming the Embedding_Service initializes and embeds with no
 * `GEMINI_API_KEY` present in the environment (R6.7).
 *
 * Gemini is already gone: text generation runs on Groq and embeddings run
 * against the HuggingFace Inference API. `GEMINI_API_KEY` must therefore never
 * appear on the embedding init or embed path, and its absence must never raise
 * an initialization error.
 *
 * These tests delete `GEMINI_API_KEY` for the duration of each test body and
 * assert:
 * 1. `getEmbeddingConfig()` resolves without throwing and yields the expected
 *    primary provider id and model.
 * 2. `createPrimaryProvider()` constructs successfully without `GEMINI_API_KEY`.
 * 3. `embedText` resolves to a 768-element vector using an injected stub
 *    provider, proving the embed path has no `GEMINI_API_KEY` dependency
 *    (and without hitting the network).
 */
describe("embedding init/embed without GEMINI_API_KEY (R6.7)", () => {
  let savedGeminiApiKey: string | undefined;

  beforeEach(() => {
    savedGeminiApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (savedGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = savedGeminiApiKey;
    }
  });

  it("resolves config without GEMINI_API_KEY, yielding the huggingface provider and all-mpnet model (R6.7)", () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();

    const config = getEmbeddingConfig();

    expect(config.primaryProviderId).toBe("huggingface");
    expect(config.primaryModel).toBe(
      "sentence-transformers/all-mpnet-base-v2",
    );
  });

  it("constructs the primary provider without GEMINI_API_KEY (R6.7)", () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();

    const provider = createPrimaryProvider();

    expect(provider).toBeDefined();
    expect(provider.id).toBe(
      "huggingface:sentence-transformers/all-mpnet-base-v2",
    );
    expect(provider.model).toBe("sentence-transformers/all-mpnet-base-v2");
  });

  it("embeds text to a 768-element vector without GEMINI_API_KEY or network access (R6.7)", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();

    // A 768-element stub vector returned by an injected provider — no network
    // call is made, isolating the assertion to the absence of a GEMINI_API_KEY
    // dependency on the embed path.
    const expectedVector = Array.from({ length: 768 }, (_, i) => i / 768);

    const stubPrimary = {
      id: "stub:test-model",
      model: "test-model",
      allowsAnonymous: true,
      embed: vi.fn().mockResolvedValue(expectedVector),
    };

    const result = await embedText("hello world", {
      primary: stubPrimary,
      fallback: undefined,
    });

    expect(result).toHaveLength(768);
    expect(result).toEqual(expectedVector);
    expect(stubPrimary.embed).toHaveBeenCalledTimes(1);
  });
});
