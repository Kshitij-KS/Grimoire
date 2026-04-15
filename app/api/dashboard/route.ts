export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/api";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;

  // Fetch all worlds with stats
  const { data: worlds } = await supabase
    .from("worlds")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Aggregate stats across all worlds
  const worldIds = (worlds ?? []).map((w) => w.id);

  const [
    { count: totalLore },
    { count: totalSouls },
    { count: totalEntities },
  ] = await Promise.all([
    supabase
      .from("lore_entries")
      .select("*", { head: true, count: "exact" })
      .in("world_id", worldIds.length > 0 ? worldIds : ["none"]),
    supabase
      .from("souls")
      .select("*", { head: true, count: "exact" })
      .in("world_id", worldIds.length > 0 ? worldIds : ["none"]),
    supabase
      .from("entities")
      .select("*", { head: true, count: "exact" })
      .in("world_id", worldIds.length > 0 ? worldIds : ["none"]),
  ]);

  // Get recent activity (last 10 items across all worlds)
  const [
    { data: recentLore },
    { data: recentSouls },
    { data: recentChecks },
  ] = await Promise.all([
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
  ]);

  const worldMap = new Map((worlds ?? []).map((w) => [w.id, w.name]));

  const activity = [
    ...(recentLore ?? []).map((l) => ({
      id: l.id,
      type: "lore_created" as const,
      title: l.title ?? "Untitled Lore",
      description: "New lore inscribed",
      world_id: l.world_id,
      world_name: worldMap.get(l.world_id) ?? "Unknown",
      created_at: l.created_at,
    })),
    ...(recentSouls ?? []).map((s) => ({
      id: s.id,
      type: "soul_forged" as const,
      title: s.name,
      description: "Soul forged from the archive",
      world_id: s.world_id,
      world_name: worldMap.get(s.world_id) ?? "Unknown",
      created_at: s.created_at,
    })),
    ...(recentChecks ?? []).map((c) => ({
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

  // Fetch shared worlds (via world_members)
  const { data: memberships } = await supabase
    .from("world_members")
    .select("world_id, role")
    .eq("user_id", user.id);

  const sharedWorldIds = (memberships ?? []).map((m) => m.world_id);
  const memberRoleMap = new Map((memberships ?? []).map((m) => [m.world_id, m.role]));

  const { data: sharedWorlds } = sharedWorldIds.length > 0
    ? await supabase.from("worlds").select("*").in("id", sharedWorldIds).order("updated_at", { ascending: false })
    : { data: [] };

  // All world IDs combined for stats
  const allWorldIds = [...worldIds, ...sharedWorldIds];

  // Get per-world stats (owned + shared)
  const worldStats: Record<string, { lore: number; souls: number; entities: number }> = {};
  for (const wId of allWorldIds) {
    const [{ count: wLore }, { count: wSouls }, { count: wEntities }] =
      await Promise.all([
        supabase.from("lore_entries").select("*", { head: true, count: "exact" }).eq("world_id", wId),
        supabase.from("souls").select("*", { head: true, count: "exact" }).eq("world_id", wId),
        supabase.from("entities").select("*", { head: true, count: "exact" }).eq("world_id", wId),
      ]);
    worldStats[wId] = { lore: wLore ?? 0, souls: wSouls ?? 0, entities: wEntities ?? 0 };
  }

  return Response.json({
    worlds: (worlds ?? []).map((w) => ({
      ...w,
      stats: worldStats[w.id] ?? { lore: 0, souls: 0, entities: 0 },
    })),
    sharedWorlds: (sharedWorlds ?? []).map((w) => ({
      ...w,
      memberRole: memberRoleMap.get(w.id) ?? "viewer",
      stats: worldStats[w.id] ?? { lore: 0, souls: 0, entities: 0 },
    })),
    profile: profile ?? null,
    recentActivity: activity,
    globalStats: {
      totalWorlds: worldIds.length,
      totalLore: totalLore ?? 0,
      totalSouls: totalSouls ?? 0,
      totalEntities: totalEntities ?? 0,
    },
  });
}
