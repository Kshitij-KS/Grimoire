import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getSessionUser } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (hasSupabaseEnv() && !user) {
    redirect("/auth");
  }

  let dashboardData = null;

  if (user) {
    try {
      const supabase = createServerSupabaseClient();

      // Fetch worlds with stats
      const { data: worlds } = await supabase
        .from("worlds")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      const worldIds = (worlds ?? []).map((w: { id: string }) => w.id);

      // Parallel stats queries
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

      // Per-world stats
      const worldStats: Record<string, { lore: number; souls: number; entities: number }> = {};
      for (const wId of worldIds) {
        const [{ count: wLore }, { count: wSouls }, { count: wEntities }] =
          await Promise.all([
            supabase.from("lore_entries").select("*", { head: true, count: "exact" }).eq("world_id", wId),
            supabase.from("souls").select("*", { head: true, count: "exact" }).eq("world_id", wId),
            supabase.from("entities").select("*", { head: true, count: "exact" }).eq("world_id", wId),
          ]);
        worldStats[wId] = { lore: wLore ?? 0, souls: wSouls ?? 0, entities: wEntities ?? 0 };
      }

      // Recent activity
      const [{ data: recentLore }, { data: recentSouls }, { data: recentChecks }] = await Promise.all([
        supabase.from("lore_entries").select("id, title, world_id, created_at")
          .in("world_id", worldIds.length > 0 ? worldIds : ["none"])
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("souls").select("id, name, world_id, created_at")
          .in("world_id", worldIds.length > 0 ? worldIds : ["none"])
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("consistency_checks").select("id, world_id, created_at")
          .in("world_id", worldIds.length > 0 ? worldIds : ["none"])
          .order("created_at", { ascending: false }).limit(3),
      ]);

      const worldMap = new Map((worlds ?? []).map((w: { id: string; name: string }) => [w.id, w.name]));

      const activity = [
        ...(recentLore ?? []).map((l: { id: string; title: string | null; world_id: string; created_at: string }) => ({
          id: l.id, type: "lore_created" as const, title: l.title ?? "Untitled Lore",
          description: "New lore inscribed", world_id: l.world_id,
          world_name: worldMap.get(l.world_id) ?? "Unknown", created_at: l.created_at,
        })),
        ...(recentSouls ?? []).map((s: { id: string; name: string; world_id: string; created_at: string }) => ({
          id: s.id, type: "soul_forged" as const, title: s.name,
          description: "Soul forged from the archive", world_id: s.world_id,
          world_name: worldMap.get(s.world_id) ?? "Unknown", created_at: s.created_at,
        })),
        ...(recentChecks ?? []).map((c: { id: string; world_id: string; created_at: string }) => ({
          id: c.id, type: "consistency_check", title: "Consistency Scan",
          description: "Archive scanned for contradictions", world_id: c.world_id,
          world_name: worldMap.get(c.world_id) ?? "Unknown", created_at: c.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

      dashboardData = {
        worlds: (worlds ?? []).map((w: { id: string; [key: string]: unknown }) => ({
          ...w,
          stats: worldStats[w.id] ?? { lore: 0, souls: 0, entities: 0 },
        })),
        globalStats: {
          totalWorlds: worldIds.length,
          totalLore: totalLore ?? 0,
          totalSouls: totalSouls ?? 0,
          totalEntities: totalEntities ?? 0,
        },
        recentActivity: activity,
      };
    } catch (e) {
      console.error("Dashboard data fetch error:", e);
    }
  }

  const displayName = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(" ")[0]
    : null;

  return (
    <main className="page-fade min-h-screen">
      <DashboardNav isAuthed={Boolean(user)} userEmail={user?.email} />
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        {dashboardData ? (
          <DashboardOverview
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            worlds={dashboardData.worlds as unknown as any[]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sharedWorlds={(dashboardData as any).sharedWorlds as unknown as any[]}
            globalStats={dashboardData.globalStats}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recentActivity={dashboardData.recentActivity as unknown as any[]}
            displayName={displayName}
          />
        ) : (
          <div className="space-y-6 text-center">
            <h1 className="font-heading text-5xl text-foreground">
              {displayName ? `Your worlds await, ${displayName}.` : "Your worlds await."}
            </h1>
            <p className="text-sm text-secondary">
              Connect to Supabase to see your worlds here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
