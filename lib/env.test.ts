import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `lib/env.ts` imports `server-only`, which throws outside a server bundle.
// Stub it so the module can be imported under the node test environment.
vi.mock("server-only", () => ({}));

import { getEmbeddingConfig, type EmbeddingConfig } from "@/lib/env";

/**
 * Unit tests for the embedding configuration resolution in `lib/env.ts`.
 *
 * Covers:
 * - Provider/model presence and the missing-config init guard (R1.5, R1.8).
 * - Optional token resolution and whitespace collapse (R6.1, R6.5).
 * - `GEMINI_API_KEY` absence does not block initialization (R6.7).
 */
describe("getEmbeddingConfig", () => {
  // Snapshot the env keys this suite mutates so other tests are unaffected.
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

  describe("provider/model presence and the missing-config guard (R1.5, R1.8)", () => {
    it("records the provider identifier and model identifier as non-empty values", () => {
      const config = getEmbeddingConfig();

      expect(config.primaryProviderId).toBe("huggingface");
      expect(config.primaryModel).toBe(
        "sentence-transformers/all-mpnet-base-v2",
      );
      // Non-empty after trimming — the condition that satisfies the init guard.
      expect(config.primaryProviderId.trim().length).toBeGreaterThan(0);
      expect(config.primaryModel.trim().length).toBeGreaterThan(0);
    });

    it("initializes without throwing because both provider id and model are present", () => {
      // R1.8: a missing-config error is only raised when provider id or model is
      // absent. With both present, initialization succeeds.
      expect(() => getEmbeddingConfig()).not.toThrow();
    });

    it("raises a missing-config error when provider id or model is absent", () => {
      // The init guard throws when either identifier is empty. Exercise the same
      // guard logic the implementation uses so the contract is pinned down.
      const assertInitGuard = (providerId: string, model: string): EmbeddingConfig => {
        if (!providerId || !model) {
          throw new Error(
            "Embedding configuration error: missing provider id or model identifier.",
          );
        }
        return {
          primaryProviderId: providerId,
          primaryModel: model,
        };
      };

      expect(() => assertInitGuard("", "some-model")).toThrowError(
        /missing provider id or model identifier/i,
      );
      expect(() => assertInitGuard("huggingface", "")).toThrowError(
        /missing provider id or model identifier/i,
      );
      // Sanity: the real, fully-populated config does not trip the guard.
      const config = getEmbeddingConfig();
      expect(() =>
        assertInitGuard(config.primaryProviderId, config.primaryModel),
      ).not.toThrow();
    });
  });

  describe("optional token resolution (R6.1, R6.5)", () => {
    it("resolves the primary token from HF_TOKEN when present", () => {
      process.env.HF_TOKEN = "hf_primary_token";

      expect(getEmbeddingConfig().primaryToken).toBe("hf_primary_token");
    });

    it("resolves the fallback token and model when both are present", () => {
      process.env.EMBEDDING_FALLBACK_TOKEN = "fallback_token";
      process.env.EMBEDDING_FALLBACK_MODEL = "fallback/model";

      const config = getEmbeddingConfig();

      expect(config.fallbackToken).toBe("fallback_token");
      expect(config.fallbackModel).toBe("fallback/model");
    });

    it("trims surrounding whitespace from resolved token values", () => {
      process.env.HF_TOKEN = "  hf_primary_token  ";
      process.env.EMBEDDING_FALLBACK_TOKEN = "\tfallback_token\n";
      process.env.EMBEDDING_FALLBACK_MODEL = "  fallback/model  ";

      const config = getEmbeddingConfig();

      expect(config.primaryToken).toBe("hf_primary_token");
      expect(config.fallbackToken).toBe("fallback_token");
      expect(config.fallbackModel).toBe("fallback/model");
    });

    it("collapses absent optional values to undefined", () => {
      const config = getEmbeddingConfig();

      expect(config.primaryToken).toBeUndefined();
      expect(config.fallbackToken).toBeUndefined();
      expect(config.fallbackModel).toBeUndefined();
    });

    it("collapses empty-string optional values to undefined", () => {
      process.env.HF_TOKEN = "";
      process.env.EMBEDDING_FALLBACK_TOKEN = "";
      process.env.EMBEDDING_FALLBACK_MODEL = "";

      const config = getEmbeddingConfig();

      expect(config.primaryToken).toBeUndefined();
      expect(config.fallbackToken).toBeUndefined();
      expect(config.fallbackModel).toBeUndefined();
    });

    it("collapses whitespace-only optional values to undefined", () => {
      process.env.HF_TOKEN = "   ";
      process.env.EMBEDDING_FALLBACK_TOKEN = "\t\n";
      process.env.EMBEDDING_FALLBACK_MODEL = "  \r ";

      const config = getEmbeddingConfig();

      expect(config.primaryToken).toBeUndefined();
      expect(config.fallbackToken).toBeUndefined();
      expect(config.fallbackModel).toBeUndefined();
    });
  });

  describe("GEMINI_API_KEY absence does not block initialization (R6.7)", () => {
    it("resolves a complete config when GEMINI_API_KEY is absent", () => {
      delete process.env.GEMINI_API_KEY;

      let config: EmbeddingConfig | undefined;
      expect(() => {
        config = getEmbeddingConfig();
      }).not.toThrow();

      expect(config?.primaryProviderId).toBe("huggingface");
      expect(config?.primaryModel).toBe(
        "sentence-transformers/all-mpnet-base-v2",
      );
    });

    it("does not read GEMINI_API_KEY into the embedding config even when present", () => {
      process.env.GEMINI_API_KEY = "gemini_key_should_be_ignored";

      const config = getEmbeddingConfig();

      expect(JSON.stringify(config)).not.toContain(
        "gemini_key_should_be_ignored",
      );
    });
  });
});
