// Feature: free-chunking-embedding-api — Task 9.5
//
// Example-based unit tests for the write-path status transitions and the
// contents of the failed_jobs record written by the Inngest onFailure handler.
//
// Covered behaviour:
//  - Success path: processLoreEntry sets lore_entries.processing_status to
//    "complete" (R3.3).
//  - Terminal failure path: the Inngest onFailure handler inserts a failed_jobs
//    record carrying the originating chunk_index, the failure category, and the
//    final error_message, and transitions the lore entry to "failed"
//    (R3.4, R3.5, R8.3).
//
// The onFailure handler is not exported on its own; it lives inside the config
// passed to inngest.createFunction. Inngest preserves the raw handler on the
// returned function object at `.opts.onFailure`, so we invoke the real,
// unmodified production handler through that field rather than reconstructing
// its logic. getServiceClient() inside the handler builds its Supabase client
// via @supabase/supabase-js#createClient, which we mock with a capturing fake.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the Supabase client factory so the handler's getServiceClient() returns
// our capturing fake instead of opening a real connection.
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

// lib/inngest/lore-ingest.ts transitively imports lib/embeddings -> lib/env.ts,
// which begins with `import "server-only"` and throws outside a server bundle.
// Stub it so the module graph loads under the node test environment.
vi.mock("server-only", () => ({}));

import { loreIngestFunction } from "@/lib/inngest/lore-ingest";

type CapturedInsert = { table: string; values: Record<string, unknown> };
type CapturedUpdate = {
  table: string;
  values: Record<string, unknown>;
  eqColumn?: string;
  eqValue?: string;
};

function makeCapturingClient() {
  const inserts: CapturedInsert[] = [];
  const updates: CapturedUpdate[] = [];
  const client = {
    from(table: string) {
      return {
        insert(values: Record<string, unknown>) {
          inserts.push({ table, values });
          return Promise.resolve({ error: null });
        },
        update(values: Record<string, unknown>) {
          const update: CapturedUpdate = { table, values };
          updates.push(update);
          return {
            eq(column: string, value: string) {
              update.eqColumn = column;
              update.eqValue = value;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client, inserts, updates };
}

// Narrow accessor for the raw production onFailure handler preserved by Inngest.
type OnFailureArg = {
  error: { message: string; name?: string; category?: unknown };
  event: { data: Record<string, unknown> };
};
function getOnFailureHandler(): (arg: OnFailureArg) => Promise<void> {
  const fn = loreIngestFunction as unknown as {
    opts: { onFailure: (arg: OnFailureArg) => Promise<void> };
  };
  return fn.opts.onFailure;
}

function makeFailureEvent() {
  return {
    data: {
      event: {
        data: { userId: "user-1", worldId: "world-1", entryId: "entry-1" },
      },
    },
  };
}

describe("write-path status transitions and failed_jobs contents", () => {
  describe("success path (R3.3)", () => {
    it("sets lore_entries.processing_status to 'complete' on success", async () => {
      vi.resetModules();
      vi.doMock("@/lib/embeddings", () => ({
        embedText: vi
          .fn()
          .mockResolvedValue(Array.from({ length: 768 }, () => 0.1)),
        extractEntities: vi.fn().mockResolvedValue([]),
      }));

      const updates: Record<string, unknown[]> = {};
      const supabase = {
        from(table: string) {
          return {
            update(values: unknown) {
              updates[table] ??= [];
              updates[table].push(values);
              return { eq: () => Promise.resolve({ error: null }) };
            },
            delete() {
              return { eq: () => Promise.resolve({ error: null }) };
            },
            insert() {
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

      const { processLoreEntry } = await import("@/lib/lore-processing");
      const result = await processLoreEntry({
        supabase,
        worldId: "world-1",
        entryId: "entry-1",
        content: "The keep stood silent above the frozen river.",
      });

      // The final status update must be "complete", and it must be the last
      // status the entry transitions to (after the initial "processing").
      expect(updates.lore_entries).toContainEqual({
        processing_status: "complete",
      });
      const statuses = (updates.lore_entries as Array<{
        processing_status?: string;
      }>).map((u) => u.processing_status);
      expect(statuses[statuses.length - 1]).toBe("complete");
      expect(result.chunksCreated).toBeGreaterThan(0);

      vi.doUnmock("@/lib/embeddings");
      vi.resetModules();
    });
  });

  describe("terminal failure path (R3.4, R3.5, R8.3)", () => {
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
      createClientMock.mockReset();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("records chunk_index, category, and error_message and sets the entry to 'failed' (category + chunk parsed from message)", async () => {
      const captured = makeCapturingClient();
      createClientMock.mockReturnValue(captured.client);

      const error = {
        name: "EmbeddingError",
        message:
          "Embedding failed for chunk 3 after 6 attempts (rate-limit): primary provider exhausted",
      };

      await getOnFailureHandler()({ error, event: makeFailureEvent() });

      // A failed_jobs row is inserted with the recovered observability fields.
      const failedJob = captured.inserts.find(
        (i) => i.table === "failed_jobs",
      );
      expect(failedJob).toBeDefined();
      const values = failedJob!.values;
      expect(values.user_id).toBe("user-1");
      expect(values.world_id).toBe("world-1");
      expect(values.lore_entry_id).toBe("entry-1");
      expect(values.event_name).toBe("lore.inscribed");
      expect(values.status).toBe("failed");
      // Final error message recorded verbatim in its dedicated column (R8.3).
      expect(values.error_message).toBe(error.message);
      // chunk_index and category live inside the payload jsonb (R3.4).
      const payload = values.payload as Record<string, unknown>;
      expect(payload.chunk_index).toBe(3);
      expect(payload.category).toBe("rate-limit");

      // The lore entry transitions to "failed" (R3.5).
      const entryUpdate = captured.updates.find(
        (u) => u.table === "lore_entries",
      );
      expect(entryUpdate).toBeDefined();
      expect(entryUpdate!.values).toEqual({ processing_status: "failed" });
      expect(entryUpdate!.eqColumn).toBe("id");
      expect(entryUpdate!.eqValue).toBe("entry-1");
    });

    it("prefers a structured category field and records null chunk_index when the message has no chunk reference", async () => {
      const captured = makeCapturingClient();
      createClientMock.mockReturnValue(captured.client);

      const error = {
        name: "EmbeddingError",
        category: "dimension-mismatch",
        message: "provider returned a vector of length 512, expected 768",
      };

      await getOnFailureHandler()({ error, event: makeFailureEvent() });

      const failedJob = captured.inserts.find(
        (i) => i.table === "failed_jobs",
      );
      expect(failedJob).toBeDefined();
      const payload = failedJob!.values.payload as Record<string, unknown>;
      expect(payload.category).toBe("dimension-mismatch");
      expect(payload.chunk_index).toBeNull();
      expect(failedJob!.values.error_message).toBe(error.message);

      const entryUpdate = captured.updates.find(
        (u) => u.table === "lore_entries",
      );
      expect(entryUpdate!.values).toEqual({ processing_status: "failed" });
    });

    it("records null category when none can be recovered from the error", async () => {
      const captured = makeCapturingClient();
      createClientMock.mockReturnValue(captured.client);

      const error = {
        name: "Error",
        message: "something went wrong with no recognizable markers",
      };

      await getOnFailureHandler()({ error, event: makeFailureEvent() });

      const failedJob = captured.inserts.find(
        (i) => i.table === "failed_jobs",
      );
      const payload = failedJob!.values.payload as Record<string, unknown>;
      expect(payload.category).toBeNull();
      expect(payload.chunk_index).toBeNull();
    });
  });
});
