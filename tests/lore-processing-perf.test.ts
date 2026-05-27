import { describe, expect, it, vi } from "vitest";
import { performance } from "perf_hooks";

describe("processLoreEntry performance", () => {
  it("processes many entities efficiently", async () => {
    vi.resetModules();

    // Create 100 mock entities
    const mockEntities = Array.from({ length: 100 }, (_, i) => ({
      name: `Entity ${i}`,
      type: "character",
      summary: `Summary for entity ${i}`
    }));

    vi.doMock("@/lib/embeddings", () => ({
      embedText: vi.fn().mockResolvedValue(Array.from({ length: 768 }, () => 0.1)),
      extractEntities: vi.fn().mockResolvedValue(mockEntities),
    }));

    // Mock supabase with simulated network latency
    let rpcCalls = 0;
    const supabase = {
      from(table: string) {
        return {
          update() { return { eq: () => Promise.resolve({ error: null }) }; },
          delete() { return { eq: () => Promise.resolve({ error: null }) }; },
          insert() { return Promise.resolve({ error: null }); },
          upsert() { return Promise.resolve({ error: null }); },
        };
      },
      async rpc(name: string, params: unknown) {
        rpcCalls++;
        // Simulate a 10ms network delay per RPC call
        await new Promise(resolve => setTimeout(resolve, 10));
        return { error: null };
      },
    };

    const { processLoreEntry } = await import("@/lib/lore-processing");

    const start = performance.now();
    await processLoreEntry({
      supabase,
      worldId: "world-1",
      entryId: "entry-1",
      content: "This is a test content that will be processed.",
    });
    const end = performance.now();

    const duration = end - start;
    console.log(`Processing 100 entities took: ${duration.toFixed(2)}ms`);
    console.log(`RPC calls made: ${rpcCalls}`);

    // We expect 1 RPC call after the performance improvement
    expect(rpcCalls).toBe(1);
    // 1 call * 10ms = should be much faster than 1000ms
    expect(duration).toBeLessThan(1000);
  });
});
