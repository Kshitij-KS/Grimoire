// Feature: free-chunking-embedding-api
// Task 12.1 — Integration / smoke tests.
//
// Validates (at the integration/smoke level, not as correctness properties):
//   - R1.1: a free, reachable HuggingFace provider returns a real 768-dim vector
//           and the free-tier model is selected
//           (huggingface:sentence-transformers/all-mpnet-base-v2)
//   - R3.2: request pacing follows the documented bounded backoff schedule so
//           request frequency alone does not trip throttling
//   - R3.1: five Lore_Entries ingested end-to-end store a chunk count equal to
//           the chunk count produced by chunkLoreText
//
// ───────────────────────────────────────────────────────────────────────────
// ENVIRONMENT SAFETY
// ───────────────────────────────────────────────────────────────────────────
// This suite is split into two kinds of tests:
//
//   • ALWAYS-ON (default): every assertion runs with NO real network and NO real
//     database. The provider network layer is stubbed (an injected stub
//     EmbeddingProvider / a mocked @/lib/embeddings), and Supabase is the same
//     capturing fake used by the existing lore-processing tests.
//
//   • LIVE-GATED (opt-in): the single test that performs a real HuggingFace call
//     is guarded behind `RUN_EMBEDDING_INTEGRATION === "1"`. When the flag is not
//     set (the default in CI/dev), it is SKIPPED cleanly via `describe.skipIf` —
//     it never fails due to missing network or credentials.
//
// To exercise the live portion locally:
//   RUN_EMBEDDING_INTEGRATION=1 npx vitest run tests/embedding.integration-smoke.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";

// lib/env.ts (reached transitively via @/lib/embeddings and @/lib/lore-processing)
// begins with `import "server-only"`, which throws outside a server bundle. Stub
// it so the module graph loads under the node test environment.
vi.mock("server-only", () => ({}));

import { embedText } from "@/lib/embedding/service";
import { getEmbeddingModel } from "@/lib/embeddings";
import { backoffDelayMs } from "@/lib/embedding/service";
import {
  BACKOFF_CAP_MS,
  BACKOFF_START_MS,
  MAX_RETRIES,
  REQUIRED_DIMENSION,
} from "@/lib/embedding/constants";
import { chunkLoreText } from "@/lib/chunker";
import type { EmbeddingProvider } from "@/lib/embedding/provider";

// The free-tier provider+model this feature selects. Used to assert that the
// always-on wiring reports the expected free-tier identifier without a network
// call.
const FREE_TIER_ID = "huggingface:sentence-transformers/all-mpnet-base-v2";
const FREE_TIER_MODEL = "sentence-transformers/all-mpnet-base-v2";

// ===========================================================================
// ALWAYS-ON SMOKE: real service wiring, provider network layer stubbed.
// ===========================================================================
describe("embedding smoke (always-on, no network): free-tier wiring returns 768 dims", () => {
  /**
   * A stub EmbeddingProvider standing in for the HuggingFace free-tier provider.
   * It carries the real free-tier id/model so the smoke test can assert the
   * selected provider identity, and returns a well-formed 768-element vector so
   * no network call is made. Records the text it was called with.
   */
  function makeFreeTierStub(): {
    provider: EmbeddingProvider;
    getTexts: () => string[];
  } {
    const texts: string[] = [];
    const provider: EmbeddingProvider = {
      id: FREE_TIER_ID,
      model: FREE_TIER_MODEL,
      allowsAnonymous: true,
      async embed(text: string): Promise<number[]> {
        texts.push(text);
        return Array.from({ length: REQUIRED_DIMENSION }, (_, i) => i / REQUIRED_DIMENSION);
      },
    };
    return { provider, getTexts: () => texts };
  }

  it("embedText returns a 768-dim vector via the stubbed free-tier provider (R1.1)", async () => {
    const stub = makeFreeTierStub();

    const vector = await embedText("The lantern-keeper guarded the last ember.", {
      primary: stub.provider,
      // Explicit undefined => no fallback, no Config/provider resolution, so the
      // smoke path stays fully in-memory.
      fallback: undefined,
    });

    // The real service pipeline (validateInput -> callWithRetry ->
    // dimension validation) returned a 768-element numeric vector.
    expect(vector).toHaveLength(REQUIRED_DIMENSION);
    expect(vector.every((v) => typeof v === "number" && Number.isFinite(v))).toBe(true);

    // The provider was actually invoked with the input text.
    expect(stub.getTexts()).toEqual([
      "The lantern-keeper guarded the last ember.",
    ]);
  });

  it("the active embedding model reflects free-tier selection (R1.1)", () => {
    // getEmbeddingModel() is the public surface read by both the write and read
    // paths; it must report the free, 768-dim HuggingFace model so stored and
    // query embeddings stay consistent. This needs no network.
    expect(getEmbeddingModel()).toBe(FREE_TIER_ID);

    // The stubbed provider identity matches the selected free-tier identifier,
    // confirming the smoke wiring exercises the same provider id/model.
    const stub = makeFreeTierStub();
    expect(stub.provider.id).toBe(FREE_TIER_ID);
    expect(stub.provider.model).toBe(FREE_TIER_MODEL);
  });
});

// ===========================================================================
// ALWAYS-ON SMOKE: request pacing / backoff schedule (pure helper, no sleeping).
// ===========================================================================
describe("embedding smoke (always-on): request pacing stays within the documented schedule (R3.2)", () => {
  it("backoff is non-decreasing, starts at 1s, doubles, and never exceeds the 60s cap", () => {
    // R3.2 requires the service to pace requests so frequency alone does not trip
    // throttling. The pacing/backoff schedule is verified via the pure helper —
    // no real sleeping at free-tier intervals occurs.
    const MAX_ATTEMPTS = MAX_RETRIES + 1; // initial + retries
    const delays = Array.from({ length: MAX_ATTEMPTS }, (_, i) => backoffDelayMs(i + 1));

    // Starts at the documented 1s and doubles for the early (uncapped) attempts.
    expect(delays[0]).toBe(BACKOFF_START_MS); // 1s
    expect(delays[1]).toBe(BACKOFF_START_MS * 2); // 2s
    expect(delays[2]).toBe(BACKOFF_START_MS * 4); // 4s

    // Non-decreasing across attempts and always at or below the 60s cap, so the
    // service never paces faster than the schedule allows.
    for (let i = 0; i < delays.length; i++) {
      expect(delays[i]).toBeLessThanOrEqual(BACKOFF_CAP_MS);
      if (i > 0) {
        expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
      }
    }

    // The cap holds for arbitrarily large attempt indices.
    expect(backoffDelayMs(50)).toBe(BACKOFF_CAP_MS);
  });
});

// ===========================================================================
// ALWAYS-ON SMOKE: end-to-end five Lore_Entries, mocked embedText + fake Supabase.
// ===========================================================================
describe("embedding smoke (always-on, no DB): five Lore_Entries store chunk count == produced count (R3.1)", () => {
  type InsertedRow = { embedding: number[]; lore_entry_id?: string };

  /**
   * Capturing fake Supabase client following the existing lore-processing test
   * pattern: chainable from().update/delete/insert/eq/rpc, recording the rows
   * handed to the lore_chunks insert. No real database is contacted.
   */
  function makeCapturingSupabase() {
    const loreChunkInserts: InsertedRow[] = [];
    const client = {
      from(table: string) {
        return {
          update() {
            return { eq: () => Promise.resolve({ error: null }) };
          },
          delete() {
            return { eq: () => Promise.resolve({ error: null }) };
          },
          insert(values: unknown) {
            if (table === "lore_chunks") {
              const rows = Array.isArray(values) ? values : [values];
              loreChunkInserts.push(...(rows as InsertedRow[]));
            }
            return Promise.resolve({ error: null });
          },
          upsert() {
            return Promise.resolve({ error: null });
          },
        };
      },
      rpc() {
        return Promise.resolve({ error: null });
      },
    };
    return { client, loreChunkInserts };
  }

  afterEach(() => {
    vi.doUnmock("@/lib/embeddings");
    vi.resetModules();
  });

  it("ingests five entries end-to-end; total stored chunks equal total produced chunks", async () => {
    // Scope the @/lib/embeddings mock to this test so the always-on smoke tests
    // above keep using the real embedText. The provider is mocked to a valid
    // 768-element vector so no network is hit; extractEntities returns [].
    vi.resetModules();
    vi.doMock("@/lib/embeddings", () => ({
      embedText: vi
        .fn()
        .mockResolvedValue(Array.from({ length: REQUIRED_DIMENSION }, () => 0.1)),
      extractEntities: vi.fn().mockResolvedValue([]),
    }));

    const { processLoreEntry } = await import("@/lib/lore-processing");

    // Five Lore_Entries of deliberately varied length so chunkLoreText yields
    // differing per-entry chunk counts (single short paragraph through long
    // multi-paragraph prose).
    const word = "lore ";
    const entries = [
      "A single short paragraph of world history.",
      ["The first age.", "The second age dawned slowly."].join("\n\n"),
      word.repeat(450), // long enough to span multiple ~400-word chunks
      ["Para one.", "Para two.", "Para three with more detail."].join("\n\n"),
      word.repeat(1000), // several chunks
    ].map((content, i) => ({ entryId: `entry-${i}`, content }));

    const expectedTotal = entries.reduce(
      (sum, e) => sum + chunkLoreText(e.content).length,
      0,
    );

    const { client, loreChunkInserts } = makeCapturingSupabase();

    // Model the batch as five independent processLoreEntry invocations, exactly
    // as the Inngest job processes one entry per event/invocation.
    let producedTotal = 0;
    for (const entry of entries) {
      const result = await processLoreEntry({
        supabase: client,
        worldId: "world-1",
        entryId: entry.entryId,
        content: entry.content,
      });
      producedTotal += result.chunksCreated;
    }

    // Sanity: we actually exercised five entries producing real chunks.
    expect(entries).toHaveLength(5);
    expect(expectedTotal).toBeGreaterThanOrEqual(5);

    // The stored chunk count equals the produced chunk count across all five
    // entries — no chunk dropped or duplicated (R3.1).
    expect(producedTotal).toBe(expectedTotal);
    expect(loreChunkInserts.length).toBe(expectedTotal);

    // Every stored embedding has the required 768 dimensions.
    for (const row of loreChunkInserts) {
      expect(row.embedding).toHaveLength(REQUIRED_DIMENSION);
    }
  });
});

// ===========================================================================
// LIVE-GATED: real HuggingFace call. SKIPPED unless RUN_EMBEDDING_INTEGRATION=1.
// ===========================================================================
const RUN_LIVE = process.env.RUN_EMBEDDING_INTEGRATION === "1";

describe.skipIf(!RUN_LIVE)(
  "embedding LIVE integration (opt-in via RUN_EMBEDDING_INTEGRATION=1): real HuggingFace 768-dim vector (R1.1)",
  () => {
    it("reaches the free-tier provider and returns a real 768-dim vector", async () => {
      // Use the ACTUAL HuggingFace client (no mock) to confirm free-tier
      // reachability and that the selected model emits 768 dimensions. A free
      // HF_TOKEN is used if present; anonymous access is otherwise attempted.
      const actual = await vi.importActual<typeof import("@huggingface/inference")>(
        "@huggingface/inference",
      );
      const client = new actual.HfInference(process.env.HF_TOKEN || undefined);

      const result = await client.featureExtraction({
        model: FREE_TIER_MODEL,
        inputs: "A worldbuilder stores the first entry of lore.",
      });

      // Normalize number[] | number[][] the way HuggingFaceProvider does.
      const vector = Array.isArray(result[0])
        ? (result as number[][])[0]
        : (result as number[]);

      expect(vector).toHaveLength(REQUIRED_DIMENSION);
      expect(vector.every((v) => typeof v === "number" && Number.isFinite(v))).toBe(
        true,
      );
    }, 60_000);
  },
);
