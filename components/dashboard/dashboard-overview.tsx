"use client";

import { useEffect, useRef, useState } from "react";
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

// ── Count-up hook ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const step = (ts: number) => {
      if (!startTime.current) startTime.current = ts;
      const elapsed = ts - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return count;
}

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

// CSS variable strings for stat colors
const statCards = [
  { key: "totalWorlds" as const, label: "Worlds Forged", icon: Globe2, colorVar: "var(--text-muted)" },
  { key: "totalLore" as const, label: "Lore Inscribed", icon: ScrollText, colorVar: "var(--accent)" },
  { key: "totalSouls" as const, label: "Souls Bound", icon: Users, colorVar: "var(--ai-pulse)" },
  { key: "totalEntities" as const, label: "Entities Discovered", icon: Sparkles, colorVar: "var(--accent)" },
];

function StatCard({
  label,
  icon: Icon,
  colorVar,
  value,
  delay,
}: {
  label: string;
  icon: typeof Globe2;
  colorVar: string;
  value: number;
  delay: number;
}) {
  const count = useCountUp(value, 900);
  return (
    <motion.div
      className="stat-card-hover glass-panel group relative overflow-hidden rounded-[14px] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] rounded-t-[14px] opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${colorVar} 80%, transparent), color-mix(in srgb, ${colorVar} 30%, transparent), transparent)` }}
      />
      {/* Inner ambient glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(ellipse 80% 60% at 20% 20%, color-mix(in srgb, ${colorVar} 8%, transparent), transparent 60%)` }}
      />
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
          style={{ background: `color-mix(in srgb, ${colorVar} 12%, transparent)` }}
        >
          <Icon className="h-4 w-4" style={{ color: colorVar }} />
        </div>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="font-heading text-5xl text-[var(--text-main)] tabular-nums">{count}</p>
    </motion.div>
  );
}

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

// Re-colored to use CSS variables via inline strings
const typeColors: Record<string, string> = {
  lore_created:      "color-mix(in srgb, var(--accent) 12%, transparent)",
  soul_forged:       "color-mix(in srgb, var(--ai-pulse) 12%, transparent)",
  consistency_check: "color-mix(in srgb, var(--danger) 10%, transparent)",
  chat_message:      "color-mix(in srgb, var(--ai-pulse) 12%, transparent)",
  entity_discovered: "color-mix(in srgb, var(--accent) 10%, transparent)",
};

const typeIconColors: Record<string, string> = {
  lore_created:      "var(--accent)",
  soul_forged:       "var(--ai-pulse)",
  consistency_check: "var(--danger)",
  chat_message:      "var(--ai-pulse)",
  entity_discovered: "var(--accent)",
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
        <h1 className="font-heading text-5xl text-[var(--text-main)]">
          {displayName ? `Welcome back, ${displayName}.` : "Welcome back, Worldbuilder."}
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
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
        {statCards.map(({ key, label, icon, colorVar }, i) => (
          <StatCard
            key={key}
            label={label}
            icon={icon}
            colorVar={colorVar}
            value={globalStats[key]}
            delay={0.1 + i * 0.07}
          />
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Worlds Grid ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">Your Worlds</h2>
            <Button size="sm" asChild>
              <Link href="/worlds/new">Forge New World</Link>
            </Button>
          </div>

          {worlds.length === 0 ? (
            <div className="glass-panel rounded-[16px] p-10 text-center">
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
                <span
                  className="pointer-events-none absolute select-none font-heading text-4xl opacity-[0.06] text-[var(--accent)]"
                  aria-hidden
                >ᚷ</span>
                <Globe2 className="relative z-10 h-7 w-7 text-[var(--text-muted)]" />
              </div>
              <h3 className="font-heading text-2xl text-[var(--text-main)] italic">Your first world awaits.</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Forge a world to begin. One world on the free tier — no credit card required.
              </p>
              <Button className="mt-5" asChild>
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
                    <div className="glass-panel hoverable-card group overflow-hidden rounded-[16px]">
                      {/* Color gradient bar — brightens on hover */}
                      <div
                        className="relative h-20 overflow-hidden rounded-t-[16px] transition-all duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${world.cover_color}44, ${world.cover_color}11)`,
                        }}
                      >
                        {/* Hover overlay — adds warmth */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{
                            background: `linear-gradient(135deg, ${world.cover_color}70, ${world.cover_color}22)`,
                          }}
                        />
                        <div className="absolute inset-0 bg-grid opacity-15" />
                        <p
                          className="absolute bottom-1 left-4 select-none font-heading text-5xl font-bold leading-none opacity-[0.06] group-hover:opacity-[0.1] transition-opacity duration-300"
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
                          <h3 className="font-heading text-2xl text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                            {world.name}
                          </h3>
                          {world.premise && (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                              {world.premise.slice(0, 100)}&hellip;
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                          <span className="flex items-center gap-1">
                            <BookOpenText className="h-3 w-3 text-[var(--accent)]" />
                            {world.stats.lore} lore
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-[var(--ai-pulse)]" />
                            {world.stats.souls} souls
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-[var(--text-muted)]" />
                            {world.stats.entities} entities
                          </span>
                        </div>

                        <p className="text-[10px] text-[var(--text-muted)] opacity-65" suppressHydrationWarning>
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
            <TrendingUp className="h-4 w-4 text-[var(--text-muted)]" />
            <h2 className="font-heading text-2xl text-[var(--text-main)]">Recent Activity</h2>
          </div>

          <div className="glass-panel rounded-[14px] divide-y divide-[var(--border)]">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                No activity yet. Start inscribing lore to see your progress here.
              </div>
            ) : (
              recentActivity.map((item, i) => {
                const Icon = activityIcons[item.type] ?? Clock;
                return (
                  <motion.div
                    key={item.id}
                    className="group flex items-start gap-3 p-4 first:rounded-t-[14px] last:rounded-b-[14px] hover:bg-[var(--surface)] transition-[background] duration-150 cursor-default"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
                  >
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110"
                      style={{ background: typeColors[item.type] ?? "color-mix(in srgb, var(--ai-pulse) 10%, transparent)" }}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: typeIconColors[item.type] ?? "var(--ai-pulse-soft)" }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-main)] truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {item.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Link
                          href={`/worlds/${item.world_id}`}
                          className="text-[10px] text-[var(--accent)] hover:underline"
                        >
                          {item.world_name}
                        </Link>
                        <span className="text-[10px] text-[var(--text-muted)] opacity-65" suppressHydrationWarning>
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
          <div className="glass-panel arcane-border rounded-[14px] p-5 space-y-3">
            <p className="chapter-label">— Quick Actions —</p>
            <div className="grid gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2 transition-all hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
                asChild
              >
                <Link href="/demo">
                  <Compass className="h-3.5 w-3.5" />
                  Explore Ashveil Demo
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2 transition-all hover:border-[color-mix(in_srgb,var(--ai-pulse)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--ai-pulse)_6%,transparent)]"
                asChild
              >
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
