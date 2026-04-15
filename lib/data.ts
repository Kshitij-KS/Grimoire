import { DAILY_LIMITS } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";
import {
  demoChecks,
  demoEntities,
  demoFlags,
  demoLoreEntries,
  demoSouls,
  demoStats,
  demoUsage,
  demoWorld,
} from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ConsistencyCheck,
  ConsistencyFlag,
  Entity,
  LoreEntry,
  MemberRole,
  Soul,
  UsageMeter,
  World,
  WorldWorkspaceData,
} from "@/lib/types";

export async function getSessionUser() {
  if (!hasSupabaseEnv()) return null;
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  if (!hasSupabaseEnv()) return null;
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export async function getWorldsForDashboard() {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const user = await getSessionUser();
  if (!user) return [];

  const supabase = createServerSupabaseClient();
  const { data: worlds } = await supabase
    .from("worlds")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (!worlds) return [];

  const worldIds = worlds.map((world) => world.id);
  const [loreEntriesRes, soulsRes, flagsRes] = await Promise.all([
    supabase.from("lore_entries").select("world_id").in("world_id", worldIds),
    supabase.from("souls").select("world_id").in("world_id", worldIds),
    supabase.from("consistency_flags").select("world_id").in("world_id", worldIds).eq("resolved", false),
  ]);

  const countByWorld = (rows: Array<{ world_id: string }> | null | undefined) =>
    (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.world_id] = (acc[row.world_id] ?? 0) + 1;
      return acc;
    }, {});

  const loreCounts = countByWorld(loreEntriesRes.data as Array<{ world_id: string }> | null);
  const soulCounts = countByWorld(soulsRes.data as Array<{ world_id: string }> | null);
  const flagCounts = countByWorld(flagsRes.data as Array<{ world_id: string }> | null);

  return worlds.map((world) => ({
    ...world,
    stats: {
      loreEntries: loreCounts[world.id] ?? 0,
      souls: soulCounts[world.id] ?? 0,
      contradictions: flagCounts[world.id] ?? 0,
    },
  }));
}

export async function getUsageMeters(userId: string): Promise<UsageMeter[]> {
  if (!hasSupabaseEnv()) return demoUsage;

  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("rate_limits")
    .select("action, count")
    .eq("user_id", userId)
    .eq("date", today);

  return (Object.entries(DAILY_LIMITS) as Array<[UsageMeter["action"], number]>).map(
    ([action, limit]) => ({
      action,
      limit,
      count: data?.find((row) => row.action === action)?.count ?? 0,
    }),
  );
}

/**
 * Returns the effective role of a user in a world.
 * Returns "owner" if they own it, the member role if shared, or null if no access.
 */
export async function getWorldRole(worldId: string, userId: string): Promise<MemberRole | null> {
  if (!hasSupabaseEnv()) return "owner";
  const supabase = createServerSupabaseClient();

  const { data: world } = await supabase
    .from("worlds")
    .select("user_id")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) return null;
  if (world.user_id === userId) return "owner";

  const { data: member } = await supabase
    .from("world_members")
    .select("role")
    .eq("world_id", worldId)
    .eq("user_id", userId)
    .maybeSingle();

  return (member?.role as MemberRole) ?? null;
}

export async function getWorldWorkspaceData(
  worldId: string,
  section: WorldWorkspaceData["activeSection"],
  isDemo = false,
): Promise<WorldWorkspaceData | null> {
  if (!hasSupabaseEnv() || isDemo) {
    return {
      world: demoWorld,
      stats: demoStats,
      usage: demoUsage,
      loreEntries: demoLoreEntries,
      entities: demoEntities,
      souls: demoSouls,
      flags: demoFlags,
      folders: [],
      relationships: [],
      activeSection: section,
      isReadonly: true,
    };
  }

  const supabase = createServerSupabaseClient();
  const user = await getSessionUser();
  if (!user) return null;

  const { data: world } = await supabase.from("worlds").select("*").eq("id", worldId).maybeSingle();
  if (!world) return null;

  // Resolve role — owner or shared member
  const memberRole = await getWorldRole(worldId, user.id);
  if (!memberRole) return null; // No access

  const [loreEntriesRes, entitiesRes, soulsRes, flagsRes, usage] = await Promise.all([
    supabase.from("lore_entries").select("*").eq("world_id", worldId).order("created_at", { ascending: false }),
    supabase.from("entities").select("*").eq("world_id", worldId).order("updated_at", { ascending: false }),
    supabase.from("souls").select("*").eq("world_id", worldId).order("updated_at", { ascending: false }),
    supabase
      .from("consistency_flags")
      .select("*")
      .eq("world_id", worldId)
      .order("created_at", { ascending: false })
      .limit(20),
    getUsageMeters(user.id),
  ]);

  const loreEntries = (loreEntriesRes.data ?? []) as LoreEntry[];
  const entities = (entitiesRes.data ?? []) as Entity[];
  const souls = (soulsRes.data ?? []) as Soul[];
  const flags = (flagsRes.data ?? []) as ConsistencyFlag[];

  return {
    world: world as World,
    stats: {
      loreEntries: loreEntries.length,
      souls: souls.length,
      contradictions: flags.filter((flag) => !flag.resolved).length,
      totalWords: loreEntries.reduce(
        (total, entry) => total + entry.content.split(/\s+/).filter(Boolean).length,
        0,
      ),
    },
    usage,
    loreEntries,
    entities,
    souls,
    flags,
    folders: [],
    relationships: [],
    activeSection: section,
    memberRole,
    isReadonly: memberRole === "viewer",
  };
}

export async function getWorldChecks(worldId: string, isDemo = false): Promise<ConsistencyCheck[]> {
  if (!hasSupabaseEnv() || isDemo) return demoChecks as ConsistencyCheck[];

  const user = await getSessionUser();
  if (!user) return [];

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("consistency_checks")
    .select("id, world_id, user_id, source_text, created_at")
    .eq("world_id", worldId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  return (data ?? []) as ConsistencyCheck[];
}

export async function getDemoData() {
  return {
    world: demoWorld,
    loreEntries: demoLoreEntries,
    entities: demoEntities,
    souls: demoSouls,
    flags: demoFlags,
    checks: demoChecks as ConsistencyCheck[],
  };
}
