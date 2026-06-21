// Feature: free-chunking-embedding-api
// Unit tests for the provider authentication paths (Task 5.5).
//
// Two distinct behaviors are covered:
//
//  - Anonymous request (R6.3): the Primary_Provider (HuggingFaceProvider) sets
//    `allowsAnonymous = true`. When no access token is present in Config, the
//    underlying HfInference client is constructed WITHOUT credentials, i.e. a
//    request is issued anonymously rather than failing.
//
//  - Missing-token, anonymous disallowed (R6.4): interpreted against the design,
//    the Fallback_Provider is the only provider that disallows anonymous access
//    (`allowsAnonymous = false`) and always requires a token. The config-gated
//    factory `createFallbackProvider` returns `undefined` whenever the fallback
//    token and/or model are absent, so no Fallback_Provider is constructed and
//    therefore no anonymous fallback request is ever issued.
//
// Validates: Requirements 6.3, 6.4
//
// `@huggingface/inference` is mocked so we can observe how the underlying client
// is constructed (with or without a token) and confirm whether any request is
// issued. `server-only` is mocked to an empty module because the provider
// transitively imports `lib/env.ts`, which begins with `import "server-only"`.

import { describe, expect, it, beforeEach, vi } from "vitest";

// Hoisted spies shared with the mocked module factory below.
const { hfConstructorSpy, featureExtractionSpy } = vi.hoisted(() => ({
  hfConstructorSpy: vi.fn(),
  featureExtractionSpy: vi.fn(),
}));

// `lib/env.ts` starts with `import "server-only"`, which throws outside a
// React Server Component context; stub it out so the module graph loads.
vi.mock("server-only", () => ({}));

// Observe HfInference client construction (token vs anonymous) and the raw
// embedding call without hitting the network.
vi.mock("@huggingface/inference", () => ({
  HfInference: class {
    constructor(...args: unknown[]) {
      hfConstructorSpy(...args);
    }
    featureExtraction(...args: unknown[]) {
      return featureExtractionSpy(...args);
    }
  },
}));

import {
  HuggingFaceProvider,
  FallbackProvider,
  createFallbackProvider,
} from "./provider";
import type { EmbeddingConfig } from "@/lib/env";

const MODEL = "sentence-transformers/all-mpnet-base-v2";

/** A valid 768-element vector the mocked client returns for successful calls. */
function vector768(): number[] {
  return Array.from({ length: 768 }, (_, i) => i * 0.001);
}

/** Build an EmbeddingConfig with optional fallback fields for factory tests. */
function makeConfig(overrides: Partial<EmbeddingConfig> = {}): EmbeddingConfig {
  return {
    primaryProviderId: "huggingface",
    primaryModel: MODEL,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  featureExtractionSpy.mockResolvedValue(vector768());
});

describe("Anonymous path: HuggingFaceProvider with no token (R6.3)", () => {
  it("declares it allows anonymous requests", () => {
    const provider = new HuggingFaceProvider({ model: MODEL });
    expect(provider.allowsAnonymous).toBe(true);
  });

  it("constructs the HfInference client WITHOUT credentials when no token is present", async () => {
    const provider = new HuggingFaceProvider({ model: MODEL });

    const result = await provider.embed("hello world", new AbortController().signal);

    // The request still goes out (anonymous access is permitted)...
    expect(result).toHaveLength(768);
    expect(featureExtractionSpy).toHaveBeenCalledTimes(1);

    // ...and the client was constructed without a token.
    expect(hfConstructorSpy).toHaveBeenCalledTimes(1);
    expect(hfConstructorSpy).toHaveBeenCalledWith(undefined);
  });

  it("attaches the token as credentials when one IS present (contrast case, R6.2)", async () => {
    const provider = new HuggingFaceProvider({ model: MODEL, token: "hf_secret" });

    await provider.embed("hello world", new AbortController().signal);

    expect(hfConstructorSpy).toHaveBeenCalledTimes(1);
    expect(hfConstructorSpy).toHaveBeenCalledWith("hf_secret");
  });
});

describe("Missing-token, anonymous disallowed path: Fallback_Provider (R6.4)", () => {
  it("the Fallback_Provider disallows anonymous access", () => {
    const provider = new FallbackProvider({ model: MODEL, token: "hf_secret" });
    expect(provider.allowsAnonymous).toBe(false);
  });

  it("createFallbackProvider returns undefined when BOTH token and model are absent — no provider, no request", () => {
    const provider = createFallbackProvider(makeConfig());

    expect(provider).toBeUndefined();
    // No provider was constructed, so no anonymous fallback request can occur.
    expect(hfConstructorSpy).not.toHaveBeenCalled();
    expect(featureExtractionSpy).not.toHaveBeenCalled();
  });

  it("createFallbackProvider returns undefined when the token is absent (model present)", () => {
    const provider = createFallbackProvider(makeConfig({ fallbackModel: MODEL }));

    expect(provider).toBeUndefined();
    expect(hfConstructorSpy).not.toHaveBeenCalled();
    expect(featureExtractionSpy).not.toHaveBeenCalled();
  });

  it("createFallbackProvider returns undefined when the model is absent (token present)", () => {
    const provider = createFallbackProvider(makeConfig({ fallbackToken: "hf_secret" }));

    expect(provider).toBeUndefined();
    expect(hfConstructorSpy).not.toHaveBeenCalled();
    expect(featureExtractionSpy).not.toHaveBeenCalled();
  });

  it("createFallbackProvider builds a token-backed provider only when BOTH are present", () => {
    const provider = createFallbackProvider(
      makeConfig({ fallbackToken: "hf_secret", fallbackModel: MODEL }),
    );

    expect(provider).toBeDefined();
    expect(provider?.allowsAnonymous).toBe(false);
  });
});
