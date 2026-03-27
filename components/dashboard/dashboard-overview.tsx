"use client";

import { motion } from "framer-motion";
import {
  BookOpenText,
  Users,
  Sparkles,
  Globe2,
  Clock,
  ScrollText,
  ShieldAlert,
  Compass,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface WorldWithStats {
  id: string;
  name: string;
  genre?: string | null;
  tone?: string | null;
  premise?: string | null;
  cover_color: string;
  updated_at: string;
  stats: { lore: number; souls: number; entities: number };
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  world_name: string;
  world_id: string;
  created_at: string;
}

interface DashboardOverviewProps {
  worlds: WorldWithStats[];
  globalStats: {
    totalWorlds: number;
    totalLore: number;
    totalSouls: number;
    totalEntities: number;
  };
  recentActivity: ActivityItem[];
  displayName: string | null;
}

const statCards = [
  { key: "totalWorlds" as const, label: "Worlds Forged", icon: Globe2, color: "#7e6df2" },
  { key: "totalLore" as const, label: "Lore Inscribed", icon: ScrollText, color: "#c4a86a" },
  { key: "totalSouls" as const, label: "Souls Bound", icon: Users, color: "#a594ff" },
  { key: "totalEntities" as const, label: "Entities Discovered", icon: Sparkles, color: "#6ecfbd" },
];

function formatRelative(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const activityIcons: Record<string, typeof BookOpenText> = {
  lore_created: ScrollText,
  soul_forged: Users,
  consistency_check: ShieldAlert,
  chat_message: Sparkles,
  entity_discovered: Compass,
};

export function DashboardOverview({
  worlds,
  globalStats,
  recentActivity,
  displayName,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-8">
      {/* ── Hero Header ── */}
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Badge variant="gold">Overview Sanctum</Badge>
        <h1 className="font-heading text-5xl text-foreground">
          {displayName ? `Welcome back, ${displayName}.` : "Welcome back, Worldbuilder."}
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-secondary">
          Your creative empire at a glance. Every word inscribed, every soul forged, every world remembered.
        </p>
      </motion.div>

      {/* ── Global Stats Grid ── */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {statCards.map(({ key, label, icon: Icon, color }, i) => (
          <div
            key={key}
            className="glass-panel group rounded-[24px] p-5 transition-all duration-200 hover:border-[rgba(165,148,255,0.25)]"
          >
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${color}18` }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <span className="text-xs text-secondary">{label}</span>
            </div>
            <motion.p
              className="font-heading text-4xl text-foreground"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
            >
              {globalStats[key]}
            </motion.p>
          </div>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Worlds Grid ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-foreground">Your Worlds</h2>
            <Button size="sm" asChild>
              <Link href="/worlds/new">Forge New World</Link>
            </Button>
          </div>

          {worlds.length === 0 ? (
            <div className="glass-panel rounded-[28px] p-8 text-center">
              <Globe2 className="mx-auto mb-3 h-8 w-8 text-secondary" />
              <p className="text-sm text-secondary">
                No worlds forged yet. Begin your first creation.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/worlds/new">Forge Your First World</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {worlds.map((world, i) => (
                <motion.div
                  key={world.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.06 }}
                >
                  <Link href={`/worlds/${world.id}`}>
                    <div className="glass-panel hoverable-card group overflow-hidden rounded-[28px]">
                      {/* Color gradient bar */}
                      <div
                        className="relative h-20 overflow-hidden rounded-t-[28px]"
                        style={{
                          background: `linear-gradient(135deg, ${world.cover_color}44, ${world.cover_color}11)`,
                        }}
                      >
                        <div className="absolute inset-0 bg-grid opacity-15" />
                        <p
                          className="absolute bottom-1 left-4 select-none font-heading text-5xl font-bold leading-none opacity-[0.06]"
                          aria-hidden
                        >
                          {world.name}
                        </p>
                        {world.genre && (
                          <div className="absolute right-3 top-2">
                            <Badge>{world.genre}</Badge>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 p-5">
                        <div>
                          <h3 className="font-heading text-2xl text-foreground group-hover:text-[var(--violet-soft)] transition-colors">
                            {world.name}
                          </h3>
                          {world.premise && (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-secondary">
                              {world.premise.slice(0, 100)}&hellip;
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-secondary">
                          <span className="flex items-center gap-1">
                            <BookOpenText className="h-3 w-3" style={{ color: "#c4a86a" }} />
                            {world.stats.lore} lore
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" style={{ color: "#a594ff" }} />
                            {world.stats.souls} souls
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" style={{ color: "#6ecfbd" }} />
                            {world.stats.entities} entities
                          </span>
                        </div>

                        <p className="text-[10px] text-dim" suppressHydrationWarning>
                          Updated {formatRelative(world.updated_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── Activity Feed ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-secondary" />
            <h2 className="font-heading text-2xl text-foreground">Recent Activity</h2>
          </div>

          <div className="glass-panel rounded-[24px] divide-y divide-border">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-sm text-secondary">
                No activity yet. Start inscribing lore to see your progress here.
              </div>
            ) : (
              recentActivity.map((item, i) => {
                const Icon = activityIcons[item.type] ?? Clock;
                return (
                  <motion.div
                    key={item.id}
                    className="flex items-start gap-3 p-4 first:rounded-t-[24px] last:rounded-b-[24px] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(165,148,255,0.1)]">
                      <Icon className="h-3.5 w-3.5 text-[var(--violet-soft)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-secondary truncate">
                        {item.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Link
                          href={`/worlds/${item.world_id}`}
                          className="text-[10px] text-[var(--violet-soft)] hover:underline"
                        >
                          {item.world_name}
                        </Link>
                        <span className="text-[10px] text-dim" suppressHydrationWarning>
                          {formatRelative(item.created_at)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-panel rounded-[24px] p-5 space-y-3">
            <p className="chapter-label">— Quick Actions —</p>
            <div className="grid gap-2">
              <Button variant="secondary" size="sm" className="w-full justify-start gap-2" asChild>
                <Link href="/demo">
                  <Compass className="h-3.5 w-3.5" />
                  Explore Ashveil Demo
                </Link>
              </Button>
              <Button variant="secondary" size="sm" className="w-full justify-start gap-2" asChild>
                <Link href="/worlds/new">
                  <Globe2 className="h-3.5 w-3.5" />
                  Forge a New World
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
