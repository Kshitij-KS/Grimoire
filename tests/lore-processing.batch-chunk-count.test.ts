// Feature: free-chunking-embedding-api, Property 15: Batch storage preserves
// total chunk count — for any batch of Lore_Entries whose chunks all embed
// successfully, the number of stored chunks equals the total number of chunks
// produced across all entries (no chunk dropped or duplicated), and every
// stored embedding has length 768.
//
// Validates: Requirements 3.1
//
// Strategy: processLoreEntry chunks content via chunkLoreText, embeds each chunk
// via embedText, then inserts the accumulated rows into lore_chunks in one
// insert call. We mock @/lib/embeddings (embedText returns a valid 768-element
// vector so no network is hit; extractEntities returns []) and supply a fake
// Supabase client whose chainable from().update/delete/insert/eq/rpc methods
// capture the rows handed to the lore_chunks insert. For arbitrary content of
// varied lengths (so chunkLoreText yields differing chunk counts), we assert the
// count of rows inserted into lore_chunks equals chunkLoreText(content).length.

import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// lib/lore-processing.ts imports @/lib/embeddings, which transitively imports
// lib/env.ts (begins with `import "server-only"`, which throws outside a server
// bundle). Stub it so the module graph loads under the node test environment.
vi.mock("server-only", () => ({}));

// Mock the embedding surface so no network is hit: embedText yields a valid
// 768-element vector, extractEntities yields no entities. The factory is
// hoisted above all imports, so the vector must be constructed inline.
vi.mock("@/lib/embeddings", () => ({
  embedText: vi.fn().mockResolvedValue(Array.from({ length: 768 }, () => 0.1)),
  extractEntities: vi.fn().mockResolvedValue([]),
}));

import { processLoreEntry } from "@/lib/lore-processing";
import { chunkLoreText } from "@/lib/chunker";

type InsertedRow = { embedding: number[] };

// Build a fake Supabase client with chainable methods that capture the rows
// passed to the lore_chunks insert.
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
            // processLoreEntry always inserts an array of rows in one call.
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

describe("Property 15: batch storage preserves total chunk count", () => {
  it("inserts exactly one lore_chunks row per produced chunk, each with a 768-dim embedding", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Varied-length content so chunkLoreText yields differing chunk counts:
        // short single paragraphs, multi-paragraph blocks, and longer prose.
        fc.array(
          fc.string({ minLength: 1, maxLength: 600 }),
          { minLength: 1, maxLength: 8 },
        ),
        async (paragraphs) => {
          // Join with blank lines so chunkLoreText sees separate paragraphs.
          const content = paragraphs.join("\n\n");
          const expectedChunkCount = chunkLoreText(content).length;

          const { client, loreChunkInserts } = makeCapturingSupabase();

          const result = await processLoreEntry({
            supabase: client,
            worldId: "world-1",
            entryId: "entry-1",
            content,
          });

          // The number of rows inserted into lore_chunks equals the number of
          // chunks produced by chunkLoreText — no chunk dropped or duplicated.
          expect(loreChunkInserts.length).toBe(expectedChunkCount);
          expect(result.chunksCreated).toBe(expectedChunkCount);

          // Every stored embedding has length 768.
          for (const row of loreChunkInserts) {
            expect(row.embedding).toHaveLength(768);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
