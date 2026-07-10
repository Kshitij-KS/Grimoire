export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/api";

export async function GET(): Promise<Response> {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;

  // 5-second timeout for the entire data fetch
  const timeoutMs = 5000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DASHBOARD_TIMEOUT")), timeoutMs)
  );

  try {
    // --- Round-trip 1: fetch worlds, profile, memberships in parallel ---
    const [
      { data: worlds },
      { data: profile },
      { data: memberships },
    ] = await Promise.race([
      Promise.all([
        supabase
          .from("worlds")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single(),
        supabase
          .from("world_members")
          .select("world_id, role")
          .eq("user_id", user.id),
      ]),
      timeoutPromise,
    ]);

    const ownedWorlds = (worlds ?? []) as Array<{ id: string; name: string; [key: string]: unknown }>;
    const worldIds = ownedWorlds.map((w) => w.id);

    const membershipList = (memberships ?? []) as Array<{ world_id: string; role: string }>;
    const sharedWorldIds = membershipList.map((m) => m.world_id);
    const memberRoleMap = new Map(membershipList.map((m) => [m.world_id, m.role]));

    // All world IDs combined for stats
    const allWorldIds = [...worldIds, ...sharedWorldIds];

    // --- Round-trip 2: aggregated stats + recent activity + shared worlds in parallel ---
    const [statsResult, recentLoreResult, recentSoulsResult, recentChecksResult, sharedWorldsResult] =
      await Promise.race([
        Promise.all([
          // Aggregated stats via RPC (replaces N×3 per-world queries)
          allWorldIds.length > 0
            ? supabase.rpc("get_dashboard_stats", { p_world_ids: allWorldIds })
            : Promise.resolve({ data: [] as Array<{ world_id: string; lore_count: number; soul_count: number; entity_count: number }>, error: null }),
          // Recent activity queries
          supabase
            .from("lore_entries")
            .select("id, title, world_id, created_at")
            .in("world_id", worldIds.length > 0 ? worldIds : ["none"])
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("souls")
            .select("id, name, world_id, created_at")
            .in("world_id", worldIds.length > 0 ? worldIds : ["none"])
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("consistency_checks")
            .select("id, world_id, created_at")
            .in("world_id", worldIds.length > 0 ? worldIds : ["none"])
            .order("created_at", { ascending: false })
            .limit(3),
          // Fetch shared worlds details
          sharedWorldIds.length > 0
            ? supabase.from("worlds").select("*").in("id", sharedWorldIds).order("updated_at", { ascending: false })
            : Promise.resolve({ data: [] as Array<{ id: string; [key: string]: unknown }>, error: null }),
        ]),
        timeoutPromise,
      ]);

    // Build per-world stats map from RPC result
    const statsData = (statsResult.data ?? []) as Array<{ world_id: string; lore_count: number; soul_count: number; entity_count: number }>;
    const worldStats: Record<string, { lore: number; souls: number; entities: number }> = {};
    for (const row of statsData) {
      worldStats[row.world_id] = {
        lore: Number(row.lore_count) || 0,
        souls: Number(row.soul_count) || 0,
        entities: Number(row.entity_count) || 0,
      };
    }

    // Build world name map for activity
    const worldMap = new Map(ownedWorlds.map((w) => [w.id, w.name]));

    // Compute global stats from per-world stats
    let totalLore = 0;
    let totalSouls = 0;
    let totalEntities = 0;
    for (const wId of worldIds) {
      const s = worldStats[wId];
      if (s) {
        totalLore += s.lore;
        totalSouls += s.souls;
        totalEntities += s.entities;
      }
    }

    // Build recent activity feed
    const recentLore = (recentLoreResult.data ?? []) as Array<{ id: string; title: string | null; world_id: string; created_at: string }>;
    const recentSouls = (recentSoulsResult.data ?? []) as Array<{ id: string; name: string; world_id: string; created_at: string }>;
    const recentChecks = (recentChecksResult.data ?? []) as Array<{ id: string; world_id: string; created_at: string }>;

    const activity = [
      ...recentLore.map((l) => ({
        id: l.id,
        type: "lore_created" as const,
        title: l.title ?? "Untitled Lore",
        description: "New lore inscribed",
        world_id: l.world_id,
        world_name: worldMap.get(l.world_id) ?? "Unknown",
        created_at: l.created_at,
      })),
      ...recentSouls.map((s) => ({
        id: s.id,
        type: "soul_forged" as const,
        title: s.name,
        description: "Soul forged from the archive",
        world_id: s.world_id,
        world_name: worldMap.get(s.world_id) ?? "Unknown",
        created_at: s.created_at,
      })),
      ...recentChecks.map((c) => ({
        id: c.id,
        type: "consistency_check" as const,
        title: "Consistency Scan",
        description: "Archive scanned for contradictions",
        world_id: c.world_id,
        world_name: worldMap.get(c.world_id) ?? "Unknown",
        created_at: c.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const sharedWorlds = (sharedWorldsResult.data ?? []) as Array<{ id: string; [key: string]: unknown }>;

    return Response.json({
      worlds: ownedWorlds.map((w) => ({
        ...w,
        stats: worldStats[w.id] ?? { lore: 0, souls: 0, entities: 0 },
      })),
      sharedWorlds: sharedWorlds.map((w) => ({
        ...w,
        memberRole: memberRoleMap.get(w.id) ?? "viewer",
        stats: worldStats[w.id] ?? { lore: 0, souls: 0, entities: 0 },
      })),
      profile: profile ?? null,
      recentActivity: activity,
      globalStats: {
        totalWorlds: worldIds.length,
        totalLore,
        totalSouls,
        totalEntities,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DASHBOARD_TIMEOUT") {
      return Response.json(
        { error: "Dashboard data could not be loaded. Please refresh." },
        { status: 504 }
      );
    }
    // Re-throw unexpected errors
    throw error;
  }
}
