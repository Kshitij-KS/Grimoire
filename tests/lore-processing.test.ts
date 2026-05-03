import { describe, expect, it, vi } from "vitest";

describe("processLoreEntry", () => {
  it("creates chunks and entities for a lore entry", async () => {
    vi.resetModules();
    vi.doMock("@/lib/embeddings", () => ({
      embedText: vi.fn().mockResolvedValue(Array.from({ length: 768 }, () => 0.1)),
      extractEntities: vi.fn().mockResolvedValue([
        { name: "Mira Ashveil", type: "character", summary: "A deserter." },
        { name: "Night of Hollow Glass", type: "event", summary: "A betrayal." },
      ]),
    }));

    const inserts: Record<string, unknown[]> = {};
    const upserts: Record<string, unknown[]> = {};
    const updates: Record<string, unknown[]> = {};
    const deletes: string[] = [];

    const supabase = {
      from(table: string) {
        return {
          update(values: unknown) {
            updates[table] ??= [];
            updates[table].push(values);
            return { eq: () => Promise.resolve({ error: null }) };
          },
          delete() {
            deletes.push(table);
            return { eq: () => Promise.resolve({ error: null }) };
          },
          insert(values: unknown) {
            inserts[table] ??= [];
            inserts[table].push(values);
            return Promise.resolve({ error: null });
          },
          upsert(values: unknown) {
            upserts[table] ??= [];
            upserts[table].push(values);
            return Promise.resolve({ error: null });
          },
        };
      },
      rpc(name: string, params: unknown) {
        upserts.entities ??= [];
        upserts.entities.push(params);
        return Promise.resolve({ error: null });
      },
    };

    const { processLoreEntry } = await import("@/lib/lore-processing");
    const result = await processLoreEntry({
      supabase,
      worldId: "world-1",
      entryId: "entry-1",
      content:
        "Mira Ashveil witnessed the Night of Hollow Glass. The Night of Hollow Glass changed the city forever.",
    });

    expect(deletes).toContain("lore_chunks");
    expect(inserts.lore_chunks).toHaveLength(1);
    expect(upserts.entities).toHaveLength(2);
    expect(updates.lore_entries).toContainEqual({ processing_status: "complete" });
    expect(result.chunksCreated).toBe(1);
    expect(result.entitiesFound).toHaveLength(2);
  });
});
