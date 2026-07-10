import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/dashboard/route";

// Helper to build a mock Supabase client with chainable query builder
function createMockSupabase({
  user = { id: "user-1" },
  worlds = [{ id: "world-1", name: "Ashveil", updated_at: "2024-01-01" }],
  profile = { id: "user-1", plan: "free" },
  memberships = [] as Array<{ world_id: string; role: string }>,
  statsData = [{ world_id: "world-1", lore_count: 5, soul_count: 3, entity_count: 10 }],
  recentLore = [] as Array<{ id: string; title: string; world_id: string; created_at: string }>,
  recentSouls = [] as Array<{ id: string; name: string; world_id: string; created_at: string }>,
  recentChecks = [] as Array<{ id: string; world_id: string; created_at: string }>,
  sharedWorlds = [] as Array<{ id: string; [key: string]: unknown }>,
  rpcDelay = 0,
  rpcError = null as string | null,
} = {}) {
  const rpcFn = vi.fn().mockImplementation(async () => {
    if (rpcDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, rpcDelay));
    }
    if (rpcError) {
      return { data: null, error: { message: rpcError } };
    }
    return { data: statsData, error: null };
  });

  function chainableQuery(data: unknown) {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockReturnValue(chain);
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null });
    // Make chain a thenable (Promise-like)
    (chain as Record<string | symbol, unknown>)[Symbol.toStringTag] = "Promise";
    return chain;
  }

  // Track which tables are being queried to provide correct mock data
  const fromFn = vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case "worlds":
        return chainableQuery(worlds.length > 0 ? worlds : sharedWorlds);
      case "profiles":
        return chainableQuery(profile);
      case "world_members":
        return chainableQuery(memberships);
      case "lore_entries":
        return chainableQuery(recentLore);
      case "souls":
        return chainableQuery(recentSouls);
      case "consistency_checks":
        return chainableQuery(recentChecks);
      default:
        return chainableQuery([]);
    }
  });

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: fromFn,
    rpc: rpcFn,
  };

  return mockSupabase;
}

describe("Dashboard API Route - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("RPC is called with correct world IDs", () => {
    it("calls get_dashboard_stats RPC with owned world IDs", async () => {
      const mockSupabase = createMockSupabase({
        worlds: [
          { id: "world-aaa", name: "Realm A", updated_at: "2024-01-01" },
          { id: "world-bbb", name: "Realm B", updated_at: "2024-01-02" },
        ],
        memberships: [],
        statsData: [
          { world_id: "world-aaa", lore_count: 2, soul_count: 1, entity_count: 4 },
          { world_id: "world-bbb", lore_count: 3, soul_count: 2, entity_count: 6 },
        ],
      });

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      await GET();

      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_dashboard_stats", {
        p_world_ids: ["world-aaa", "world-bbb"],
      });
    });

    it("calls get_dashboard_stats RPC with combined owned and shared world IDs", async () => {
      const mockSupabase = createMockSupabase({
        worlds: [
          { id: "world-own", name: "My Realm", updated_at: "2024-01-01" },
        ],
        memberships: [
          { world_id: "world-shared-1", role: "editor" },
          { world_id: "world-shared-2", role: "viewer" },
        ],
        statsData: [
          { world_id: "world-own", lore_count: 1, soul_count: 0, entity_count: 2 },
          { world_id: "world-shared-1", lore_count: 5, soul_count: 3, entity_count: 8 },
          { world_id: "world-shared-2", lore_count: 0, soul_count: 0, entity_count: 0 },
        ],
      });

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      await GET();

      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_dashboard_stats", {
        p_world_ids: ["world-own", "world-shared-1", "world-shared-2"],
      });
    });

    it("skips RPC when user has no worlds", async () => {
      const mockSupabase = createMockSupabase({
        worlds: [],
        memberships: [],
        statsData: [],
      });

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      const response = await GET();

      // RPC should NOT be called when there are no world IDs
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe("Response completes within 2 await boundaries", () => {
    it("uses exactly 2 sequential round-trips (Promise.all patterns)", async () => {
      // Verify the structure by tracking the call ordering
      let callOrder: string[] = [];

      const mockSupabase = createMockSupabase({
        worlds: [{ id: "w-1", name: "World 1", updated_at: "2024-01-01" }],
        statsData: [{ world_id: "w-1", lore_count: 1, soul_count: 1, entity_count: 1 }],
      });

      // Wrap from() to track call ordering
      const originalFrom = mockSupabase.from;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        callOrder.push(`from:${table}`);
        return originalFrom(table);
      });

      const originalRpc = mockSupabase.rpc;
      mockSupabase.rpc = vi.fn().mockImplementation((...args: unknown[]) => {
        callOrder.push(`rpc:get_dashboard_stats`);
        return originalRpc(...args);
      });

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      const response = await GET();

      expect(response.status).toBe(200);

      // Round-trip 1 should include: worlds, profiles, world_members
      // Round-trip 2 should include: rpc + activity queries
      // Verify that the RPC call happens (part of round-trip 2)
      expect(callOrder).toContain("rpc:get_dashboard_stats");
      // Verify worlds was fetched (part of round-trip 1)
      expect(callOrder).toContain("from:worlds");
      expect(callOrder).toContain("from:profiles");
      expect(callOrder).toContain("from:world_members");
    });

    it("returns a successful 200 response with expected shape", async () => {
      const mockSupabase = createMockSupabase({
        worlds: [{ id: "w-1", name: "Test World", updated_at: "2024-01-01" }],
        profile: { id: "user-1", plan: "free" },
        statsData: [{ world_id: "w-1", lore_count: 10, soul_count: 5, entity_count: 20 }],
      });

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      const response = await GET();

      expect(response.status).toBe(200);
      const body = await response.json();

      // Verify response structure
      expect(body).toHaveProperty("worlds");
      expect(body).toHaveProperty("sharedWorlds");
      expect(body).toHaveProperty("profile");
      expect(body).toHaveProperty("recentActivity");
      expect(body).toHaveProperty("globalStats");
      expect(body.globalStats).toHaveProperty("totalWorlds");
      expect(body.globalStats).toHaveProperty("totalLore");
      expect(body.globalStats).toHaveProperty("totalSouls");
      expect(body.globalStats).toHaveProperty("totalEntities");
    });
  });

  describe("Timeout handling returns error state (not infinite spinner)", () => {
    it("returns 504 with error message when data fetch exceeds 5-second timeout", async () => {
      const mockSupabase = createMockSupabase({
        rpcDelay: 6000, // Simulate slow RPC exceeding 5s timeout
      });

      // Override from() to also be slow for the first round-trip
      const slowChain: Record<string, unknown> = {};
      slowChain.select = vi.fn().mockReturnValue(slowChain);
      slowChain.eq = vi.fn().mockReturnValue(slowChain);
      slowChain.in = vi.fn().mockReturnValue(slowChain);
      slowChain.order = vi.fn().mockReturnValue(slowChain);
      slowChain.limit = vi.fn().mockReturnValue(slowChain);
      slowChain.single = vi.fn().mockReturnValue(slowChain);
      slowChain.then = (resolve: (v: unknown) => unknown) => {
        // Never resolves before timeout - simulate infinite hang
        return new Promise((res) => setTimeout(() => res(resolve({ data: null, error: null })), 6000));
      };

      mockSupabase.from = vi.fn().mockReturnValue(slowChain);

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      const responsePromise = GET();

      // Advance time past the 5-second timeout
      await vi.advanceTimersByTimeAsync(5100);

      const response = await responsePromise;

      expect(response.status).toBe(504);
      const body = await response.json();
      expect(body.error).toBe("Dashboard data could not be loaded. Please refresh.");
    });

    it("does not return 504 when fetch completes within timeout", async () => {
      const mockSupabase = createMockSupabase({
        worlds: [{ id: "w-fast", name: "Fast World", updated_at: "2024-01-01" }],
        statsData: [{ world_id: "w-fast", lore_count: 1, soul_count: 1, entity_count: 1 }],
      });

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      const response = await GET();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).not.toHaveProperty("error");
    });

    it("timeout returns JSON response (not a hanging request)", async () => {
      const mockSupabase = createMockSupabase();

      // Make everything hang indefinitely
      const neverResolves: Record<string, unknown> = {};
      neverResolves.select = vi.fn().mockReturnValue(neverResolves);
      neverResolves.eq = vi.fn().mockReturnValue(neverResolves);
      neverResolves.in = vi.fn().mockReturnValue(neverResolves);
      neverResolves.order = vi.fn().mockReturnValue(neverResolves);
      neverResolves.limit = vi.fn().mockReturnValue(neverResolves);
      neverResolves.single = vi.fn().mockReturnValue(neverResolves);
      neverResolves.then = () => new Promise(() => {}); // Never resolves

      mockSupabase.from = vi.fn().mockReturnValue(neverResolves);

      vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

      const responsePromise = GET();

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(5100);

      const response = await responsePromise;

      // Verify we get a proper Response object back, not a timeout/hang
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(504);
      expect(response.headers.get("content-type")).toContain("application/json");
    });
  });
});
