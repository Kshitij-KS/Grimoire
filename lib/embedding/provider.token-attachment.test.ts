// Feature: free-chunking-embedding-api, Property 11: Primary token is attached
// to every primary request when present.
//
// For any sequence of primary-provider requests (including retries) issued
// while a primary access token is present in Config, every request carries that
// token as authentication credentials.
//
// Validates: Requirements 6.2

import { describe, expect, it, beforeEach, vi } from "vitest";
import fc from "fast-check";

// Shared capture state. Declared via `vi.hoisted` so it is initialized before
// the hoisted `vi.mock` factory below references it.
const mockState = vi.hoisted(() => {
  return {
    // One entry per `new HfInference(credentials)` construction: the exact
    // credentials argument the client was constructed with.
    constructorCredentials: [] as Array<string | undefined>,
    // Count of `featureExtraction` calls (one per embedding request).
    featureExtractionCalls: 0,
  };
});

// provider.ts imports `@/lib/env`, which transitively imports `server-only`;
// stub it so the module can load under the node test environment.
vi.mock("server-only", () => ({}));

// Capture the credentials the underlying HuggingFace client is constructed with
// and return a well-formed 768-element vector for every request.
vi.mock("@huggingface/inference", () => {
  class HfInference {
    constructor(credentials?: string) {
      mockState.constructorCredentials.push(credentials);
    }

    async featureExtraction() {
      mockState.featureExtractionCalls += 1;
      return Array.from({ length: 768 }, () => 0.1);
    }
  }

  return { HfInference };
});

// Imported after the mocks above (hoisted) so it binds to the mocked client.
import { HuggingFaceProvider } from "./provider";

describe("HuggingFaceProvider (Property 11: primary token is attached to every primary request when present)", () => {
  beforeEach(() => {
    mockState.constructorCredentials = [];
    mockState.featureExtractionCalls = 0;
  });

  // Property 11: when a non-empty token is configured, every primary request
  // (including the retries of a single sequence) is served by a client that was
  // constructed with that exact token as its credentials. No request is ever
  // issued through an anonymous / token-less client.
  it("attaches the configured token as credentials for every request in a sequence", async () => {
    await fc.assert(
      fc.asyncProperty(
        // A non-empty access token.
        fc.string({ minLength: 1 }).filter((s) => s.length > 0),
        // A sequence of 1..6 requests (initial + up to 5 retries).
        fc.integer({ min: 1, max: 6 }),
        async (token, requestCount) => {
          mockState.constructorCredentials = [];
          mockState.featureExtractionCalls = 0;

          const provider = new HuggingFaceProvider({
            model: "sentence-transformers/all-mpnet-base-v2",
            token,
          });

          for (let i = 0; i < requestCount; i++) {
            const controller = new AbortController();
            const vec = await provider.embed("some text", controller.signal);
            expect(vec).toHaveLength(768);
          }

          // Every request was actually issued.
          expect(mockState.featureExtractionCalls).toBe(requestCount);

          // At least one client was constructed, and every client that served a
          // request carried the configured token as its credentials — never
          // `undefined` (anonymous).
          expect(mockState.constructorCredentials.length).toBeGreaterThan(0);
          for (const credentials of mockState.constructorCredentials) {
            expect(credentials).toBe(token);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
