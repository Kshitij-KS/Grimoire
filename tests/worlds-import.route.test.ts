// Route-handler tests for POST /api/worlds/[id]/import (Req 6.1–6.4).
//
// Uses a hand-rolled chainable Supabase stub (per the design testing strategy)
// returned from a mocked `createServerSupabaseClient`, since the handler drives
// the fluent query builder plus a `checkAndIncrement` rate-limit RPC rather than
// raw HTTP.
//
// Coverage:
//  - 403 when requireWorldAccess denies (caller is not an editor/owner);
//  - 403 FREE_TIER_LORE_LIMIT when existing + batch would exceed the free cap;
//  - 429 short-circuit when the lore_ingest limiter reports allowed:false.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/worlds/[id]/import/route";
import { FREE_TIER_LIMITS } from "@/lib/constants";

const WORLD_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";

type StubOptions = {
  /** true → caller owns the world (owner); false → no access (denied). */
  hasAccess?: boolean;
  /** existing lore_entries count returned by the head/count select. */
  existingCount?: number;
  /** allowed flag returned by the increment_rate_limit RPC. */
  rateLimitAllowed?: boolean;
};

function makeSupabaseStub({
  hasAccess = true,
  existingCount = 0,
  rateLimitAllowed = true,
}: StubOptions = {}) {
  function resolve(table: string, op: string): { data?: unknown; error: unknown; count?: number } {
    switch (table) {
      case "worlds":
        // requireWorldAccess → getWorldAccessRole: owner when user_id matches.
        return hasAccess
          ? { data: { id: WORLD_ID, user_id: OWNER_ID }, error: null }
          : { data: { id: WORLD_ID, user_id: "someone-else" }, error: null };
      case "world_members":
        return { data: null, error: null };
      case "lore_entries":
        if (op === "select") return { data: [], error: null, count: existingCount };
        // insert → select → single()
        return {
          data: { id: "entry-1", title: "Doc", created_at: "2024-01-01T00:00:00Z" },
          error: null,
        };
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

  const rpc = vi.fn((fn: string) => {
    if (fn === "increment_rate_limit") {
      return Promise.resolve({
        data: [{ allowed: rateLimitAllowed, count: 1, limit: 10 }],
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: OWNER_ID } } }),
    },
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc,
  };

  return { client, rpc };
}

function importRequest(fileCount: number) {
  const formData = new FormData();
  for (let i = 0; i < fileCount; i++) {
    formData.append(
      "files",
      new File([`# Title ${i}\n\nSome lore content ${i}.`], `doc-${i}.md`, {
        type: "text/markdown",
      }),
    );
  }
  return new Request(`http://localhost/api/worlds/${WORLD_ID}/import`, {
    method: "POST",
    body: formData,
  });
}

const ctx = { params: { id: WORLD_ID } };

describe("POST /api/worlds/[id]/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller is not an editor/owner", async () => {
    const { client } = makeSupabaseStub({ hasAccess: false });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);

    const response = await POST(importRequest(1), ctx);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 FREE_TIER_LORE_LIMIT when the cap would be exceeded", async () => {
    // Already at the cap; importing one more would exceed it.
    const { client } = makeSupabaseStub({
      existingCount: FREE_TIER_LIMITS.loreEntries,
    });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);

    const response = await POST(importRequest(1), ctx);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("FREE_TIER_LORE_LIMIT");
    expect(body.limit).toBe(FREE_TIER_LIMITS.loreEntries);
  });

  it("returns 429 when the lore_ingest limiter is exhausted", async () => {
    const { client } = makeSupabaseStub({ rateLimitAllowed: false });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);

    const response = await POST(importRequest(1), ctx);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.action).toBe("lore_ingest");
  });
});
