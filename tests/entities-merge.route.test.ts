// Route-handler tests for POST /api/entities/merge (Req 5.6).
//
// Uses a hand-rolled chainable Supabase stub (per the design testing strategy)
// returned from a mocked `createServerSupabaseClient`, since the handler drives
// the fluent query builder plus a `replace_entity_tag` RPC rather than raw HTTP.
//
// Coverage:
//  - the merge handler invokes `replace_entity_tag` with the correct args and,
//    given a stub that applies the remap, the target name replaces the source
//    name on the affected lore chunks;
//  - the handler returns 500 TAG_REMAP_FAILED when the RPC stub errors.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/entities/merge/route";

const WORLD_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PRIMARY_ID = "33333333-3333-4333-8333-333333333333";
const SECONDARY_ID = "44444444-4444-4444-8444-444444444444";

/** Pure model of the SQL remap: array_replace(old → new) then de-duplicate. */
function remapTags(tags: string[], oldTag: string, newTag: string): string[] {
  return Array.from(new Set(tags.map((t) => (t === oldTag ? newTag : t))));
}

type LoreChunk = { id: string; world_id: string; entity_tags: string[] };

function makeSupabaseStub({
  rpcError = false,
  loreChunks = [] as LoreChunk[],
} = {}) {
  const entities = [
    { id: PRIMARY_ID, name: "Primary", world_id: WORLD_ID, user_id: USER_ID, mention_count: 2 },
    { id: SECONDARY_ID, name: "Secondary", world_id: WORLD_ID, user_id: USER_ID, mention_count: 1 },
  ];

  // Resolves the terminal value for a (table, operation) pair.
  function resolve(table: string, op: string): { data?: unknown; error: unknown } {
    switch (table) {
      case "worlds":
        // requireWorldAccess: user owns the world → "owner" (satisfies editor).
        return { data: { id: WORLD_ID, user_id: USER_ID }, error: null };
      case "world_members":
        return { data: null, error: null };
      case "entities":
        if (op === "select") return { data: entities, error: null };
        return { data: null, error: null }; // update / delete
      case "entity_relationships":
        return { data: [], error: null };
      case "lore_chunks":
        return { data: [], error: null };
      default:
        return { data: null, error: null };
    }
  }

  function makeBuilder(table: string) {
    let op = "select";
    const builder: Record<string, unknown> = {
      select: () => { op = "select"; return builder; },
      insert: () => { op = "insert"; return builder; },
      update: () => { op = "update"; return builder; },
      delete: () => { op = "delete"; return builder; },
      eq: () => builder,
      in: () => builder,
      or: () => builder,
      contains: () => builder,
      maybeSingle: () => Promise.resolve(resolve(table, op)),
      single: () => Promise.resolve(resolve(table, op)),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolve(table, op)).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const rpc = vi.fn((fn: string, args: { p_world_id: string; p_old_tag: string; p_new_tag: string }) => {
    if (fn !== "replace_entity_tag") return Promise.resolve({ data: null, error: null });
    if (rpcError) return Promise.resolve({ error: { message: "function does not exist" } });
    // Apply the remap to the in-memory chunks so tests can assert tag movement.
    for (const chunk of loreChunks) {
      if (chunk.world_id === args.p_world_id && chunk.entity_tags.includes(args.p_old_tag)) {
        chunk.entity_tags = remapTags(chunk.entity_tags, args.p_old_tag, args.p_new_tag);
      }
    }
    return Promise.resolve({ error: null });
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc,
  };

  return { client, rpc, loreChunks };
}

function mergeRequest() {
  return new Request("http://localhost/api/entities/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      worldId: WORLD_ID,
      primaryEntityId: PRIMARY_ID,
      secondaryEntityId: SECONDARY_ID,
    }),
  });
}

describe("POST /api/entities/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes replace_entity_tag with the target replacing the source and moves the tags", async () => {
    const loreChunks: LoreChunk[] = [
      { id: "chunk-1", world_id: WORLD_ID, entity_tags: ["Secondary", "Bystander"] },
    ];
    const { client, rpc } = makeSupabaseStub({ loreChunks });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);

    const response = await POST(mergeRequest());

    expect(response.status).toBe(200);

    // RPC invoked with world id, source name as old tag, target name as new tag.
    expect(rpc).toHaveBeenCalledWith("replace_entity_tag", {
      p_world_id: WORLD_ID,
      p_old_tag: "Secondary",
      p_new_tag: "Primary",
    });

    // The target name replaced the source name on the affected chunk.
    expect(loreChunks[0].entity_tags).toContain("Primary");
    expect(loreChunks[0].entity_tags).not.toContain("Secondary");
    expect(loreChunks[0].entity_tags).toContain("Bystander");
  });

  it("returns 500 TAG_REMAP_FAILED when the RPC errors", async () => {
    const { client } = makeSupabaseStub({ rpcError: true });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);

    const response = await POST(mergeRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("TAG_REMAP_FAILED");
  });
});
