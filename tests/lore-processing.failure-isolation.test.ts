// Feature: free-chunking-embedding-api, Property 16: One failed entry does not
// abort the batch.
//
// For any batch of Lore_Entries in which a single entry fails embedding after
// all retry and fallback attempts (a terminal EmbeddingError thrown from
// `processLoreEntry` for that entry), every other entry in the batch is still
// processed and its chunks stored.
//
// Validates: Requirements 3.6
//
// Batch boundary modeling: there is no single batch function in the codebase.
// The Inngest function (`lib/inngest/lore-ingest.ts`) processes exactly one
// Lore_Entry per event/invocation, and design.md states that per-entry
// isolation (R3.6) is enforced by "processing each entry as its own
// event/invocation". We therefore model the batch as independent
// `processLoreEntry` invocations run with Promise.allSettled-style independence,
// and assert that one invocation rejecting with a terminal EmbeddingError leaves
// every other invocation processed and stored, exactly as separate Inngest
// invocations would behave.
//
// The Embedding_Provider (`embedText`) is mocked: the designated failing entry's
// chunk content carries a sentinel that makes the mock throw a terminal
// EmbeddingError, while every other chunk returns a valid 768-element vector.
// The Supabase client is faked to capture the rows written to `lore_chunks`.

import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { chunkLoreText } from "@/lib/chunker";
import { EmbeddingError } from "@/lib/embedding/errors";

vi.mock("server-only", () => ({}));

const REQUIRED_DIMENSION = 768;

// A sentinel that the random word generator (alphanumeric only) can never
// produce, so it appears ONLY in the designated failing entry's content.
const FAIL_SENTINEL = "__EMBED_FAIL__";

/**
 * Build a fake Supabase client whose chainable `from().insert()` captures the
 * rows written to each table, and whose `from().update().eq()` records the
 * status updates per entry id. Returns the client plus accessors for inspecting
 * the captured `lore_chunks` rows and the `lore_entries` status updates.
 */
function createFakeSupabase() {
  const insertedRowsByTable: Record<string, unknown[]> = {};
  const statusUpdatesByEntry: Record<string, unknown[]> = {};

  const supabase = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            eq: (_column: string, value: string) => {
              if (table === "lore_entries") {
                statusUpdatesByEntry[value] ??= [];
                statusUpdatesByEntry[value].push(values);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
        delete() {
          return { eq: () => Promise.resolve({ error: null }) };
        },
        insert(values: unknown) {
          insertedRowsByTable[table] ??= [];
          if (Array.isArray(values)) {
            insertedRowsByTable[table].push(...values);
          } else {
            insertedRowsByTable[table].push(values);
          }
          return Promise.resolve({ error: null });
        },
        upsert(_values: unknown) {
          return Promise.resolve({ error: null });
        },
      };
    },
    rpc(_name: string, _params: unknown) {
      return Promise.resolve({ error: null });
    },
  };

  return {
    supabase,
    loreChunkRowsForEntry: (entryId: string) =>
      (insertedRowsByTable["lore_chunks"] ?? []).filter(
        (row) => (row as { lore_entry_id?: string }).lore_entry_id === entryId,
      ),
    statusUpdatesForEntry: (entryId: string) =>
      statusUpdatesByEntry[entryId] ?? [],
  };
}

// A single non-whitespace, purely alphanumeric "word" (never the sentinel).
const wordArb = fc
  .stringMatching(/^[A-Za-z0-9]+$/)
  .filter((w) => w.length > 0 && w.length <= 12);

// A paragraph: one or more words joined by single spaces.
const paragraphArb = fc
  .array(wordArb, { minLength: 1, maxLength: 60 })
  .map((words) => words.join(" "));

// Content: one or more paragraphs joined by blank lines.
const contentArb = fc
  .array(paragraphArb, { minLength: 1, maxLength: 4 })
  .map((paras) => paras.join("\n\n"));

describe("processLoreEntry per-entry failure isolation (Property 16)", () => {
  it("a single entry's terminal embedding failure does not stop the other entries from being processed and stored", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Vary the batch size (>= 2 so there is at least one non-failing entry)
        // and which entry in the batch is the one that fails.
        fc
          .integer({ min: 2, max: 6 })
          .chain((batchSize) =>
            fc.record({
              batchSize: fc.constant(batchSize),
              failIndex: fc.integer({ min: 0, max: batchSize - 1 }),
              contents: fc.array(contentArb, {
                minLength: batchSize,
                maxLength: batchSize,
              }),
            }),
          ),
        async ({ failIndex, contents }) => {
          vi.resetModules();
          vi.doMock("@/lib/embeddings", () => ({
            // The provider throws a terminal EmbeddingError for the failing
            // entry (sentinel present) and returns a valid 768-vector otherwise.
            embedText: vi.fn(async (text: string) => {
              if (text.includes(FAIL_SENTINEL)) {
                throw new EmbeddingError(
                  "Embedding failed for chunk 0 after 6 attempts (rate-limit): primary and fallback exhausted",
                  {
                    category: "rate-limit",
                    providersAttempted: ["huggingface", "fallback"],
                  },
                );
              }
              return Array.from({ length: REQUIRED_DIMENSION }, () => 0.1);
            }),
            extractEntities: vi.fn().mockResolvedValue([]),
          }));

          const { processLoreEntry } = await import("@/lib/lore-processing");
          const { supabase, loreChunkRowsForEntry, statusUpdatesForEntry } =
            createFakeSupabase();

          // Build the batch. The failing entry gets the sentinel prepended so
          // its first chunk triggers a terminal embedding failure; every other
          // entry uses purely-alphanumeric content that can never match it.
          const entries = contents.map((content, i) => ({
            entryId: `entry-${i}`,
            content:
              i === failIndex ? `${FAIL_SENTINEL} ${content}` : content,
            isFailing: i === failIndex,
            expectedChunks:
              i === failIndex
                ? 0
                : chunkLoreText(content).length,
          }));

          // Model the batch as independent invocations (one per entry), exactly
          // like separate Inngest per-event invocations.
          const results = await Promise.allSettled(
            entries.map((entry) =>
              processLoreEntry({
                supabase,
                worldId: "world-1",
                entryId: entry.entryId,
                content: entry.content,
              }),
            ),
          );

          // Exactly one invocation rejected: the designated failing entry, and
          // it rejected with a terminal EmbeddingError.
          const rejectedIndexes = results
            .map((r, i) => (r.status === "rejected" ? i : -1))
            .filter((i) => i >= 0);
          expect(rejectedIndexes).toEqual([failIndex]);

          const failedResult = results[failIndex];
          expect(failedResult.status).toBe("rejected");
          if (failedResult.status === "rejected") {
            expect(failedResult.reason).toBeInstanceOf(EmbeddingError);
          }

          // The failing entry persisted no chunks (no partial writes).
          expect(loreChunkRowsForEntry(entries[failIndex].entryId)).toHaveLength(
            0,
          );

          // Every OTHER entry was still processed and stored.
          for (const entry of entries) {
            if (entry.isFailing) continue;

            const idx = Number(entry.entryId.split("-")[1]);
            const settled = results[idx];
            expect(settled.status).toBe("fulfilled");
            if (settled.status === "fulfilled") {
              expect(settled.value.chunksCreated).toBe(entry.expectedChunks);
            }

            // Its chunks landed in lore_chunks with valid 768-dim embeddings.
            const rows = loreChunkRowsForEntry(entry.entryId);
            expect(rows).toHaveLength(entry.expectedChunks);
            for (const row of rows) {
              const embedding = (row as { embedding: unknown }).embedding;
              expect(Array.isArray(embedding)).toBe(true);
              expect((embedding as number[]).length).toBe(REQUIRED_DIMENSION);
            }

            // And its status was advanced to `complete`.
            expect(statusUpdatesForEntry(entry.entryId)).toContainEqual({
              processing_status: "complete",
            });
          }

          vi.doUnmock("@/lib/embeddings");
        },
      ),
      { numRuns: 100 },
    );
  });
});
