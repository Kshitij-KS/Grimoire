"use client";

import { useMemo } from "react";
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
import { useCountUp } from "@/lib/hooks/use-count-up";

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
  { key: "totalWorlds" as const, label: "Worlds Forged", icon: Globe2, colorVar: "var(--text-muted)" },
  { key: "totalLore" as const, label: "Lore Inscribed", icon: ScrollText, colorVar: "var(--accent)" },
  { key: "totalSouls" as const, label: "Souls Bound", icon: Users, colorVar: "var(--ai-pulse)" },
  { key: "totalEntities" as const, label: "Entities Discovered", icon: Sparkles, colorVar: "var(--accent)" },
];

// Deterministic sparkline: 5 points seeded from value
function Sparkline({ value, colorVar }: { value: number; colorVar: string }) {
  const pts = useMemo(() => {
    const seed = value || 1;
    const raw = [0, seed * 0.4, seed * 0.7, seed * 0.55, seed].map((v, i) => {
      // pseudo-random jitter based on position and seed
      return v + ((seed * (i + 1) * 17) % (seed * 0.3 + 1));
    });
    const max = Math.max(...raw, 1);
    return raw.map((v, i) => ({
      x: (i / 4) * 28,
      y: 16 - (v / max) * 13,
    }));
  }, [value]);

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg width="28" height="16" viewBox="0 0 28 16" fill="none" className="shrink-0">
      <path d={d} stroke={colorVar} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <circle cx={pts[4].x} cy={pts[4].y} r="1.5" fill={colorVar} opacity="0.7" />
    </svg>
  );
}

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
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
            style={{ background: `color-mix(in srgb, ${colorVar} 12%, transparent)` }}
          >
            <Icon className="h-4 w-4" style={{ color: colorVar }} />
          </div>
          <span className="text-xs text-[var(--text-muted)]">{label}</span>
        </div>
        <Sparkline value={value} colorVar={colorVar} />
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

function groupActivityByDate(items: ActivityItem[]) {
  const groups: { label: string; items: ActivityItem[] }[] = [];
  const now = new Date();
  const todayStr = now.toDateString();
  const yestStr = new Date(now.getTime() - 86400000).toDateString();

  for (const item of items) {
    const d = new Date(item.created_at).toDateString();
    const label = d === todayStr ? "Today" : d === yestStr ? "Yesterday" : formatRelative(item.created_at);
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

const activityIcons: Record<string, typeof BookOpenText> = {
  lore_created: ScrollText,
  soul_forged: Users,
  consistency_check: ShieldAlert,
  chat_message: Sparkles,
  entity_discovered: Compass,
};

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

// Decorative static SVG constellation in world card header
function ConstellationDecoration({ color }: { color: string }) {
  const nodes = [
    { cx: 20, cy: 28 }, { cx: 60, cy: 14 }, { cx: 105, cy: 22 },
    { cx: 150, cy: 10 }, { cx: 190, cy: 30 },
  ];
  const edges = [[0,1],[1,2],[2,3],[3,4],[1,3]];
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 220 44">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke={color} strokeWidth="0.8" opacity="0.25"
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r={i === 0 || i === 4 ? 2.5 : 1.8} fill={color} opacity="0.35" />
      ))}
    </svg>
  );
}

export function DashboardOverview({
  worlds,
  globalStats,
  recentActivity,
  displayName,
}: DashboardOverviewProps) {
  const activityGroups = useMemo(() => groupActivityByDate(recentActivity), [recentActivity]);

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
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">Your Worlds</h2>
            <Button size="sm" asChild>
              <Link href="/worlds/new">Forge New World</Link>
            </Button>
          </div>

          {worlds.length === 0 ? (
            <div className="glass-panel rounded-[16px] p-10 text-center">
              <p
                className="mx-auto mb-4 select-none font-heading text-6xl text-[var(--accent)]"
                style={{ opacity: 0.22 }}
                aria-hidden
              >
                ᚷ
              </p>
              <h3 className="font-heading text-2xl italic text-[var(--text-main)]">Your first world awaits.</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Forge a world to begin. One world on the free tier — no credit card required.
              </p>
              <Button className="mt-5" asChild>
                <Link href="/worlds/new">Forge Your First World</Link>
              </Button>
              {/* First steps */}
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                {[
                  { step: "01", label: "Forge a World", desc: "Name your realm and pick a genre.", color: "var(--accent)" },
                  { step: "02", label: "Inscribe Lore", desc: "Write history and let Grimoire remember.", color: "var(--ai-pulse)" },
                  { step: "03", label: "Bind a Soul", desc: "Forge characters that speak from your lore.", color: "var(--success)" },
                ].map(({ step, label, desc, color }) => (
                  <div
                    key={step}
                    className="glass-panel rounded-[12px] border-l-2 p-4"
                    style={{ borderLeftColor: color }}
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color }}>Step {step}</p>
                    <p className="text-sm font-medium text-[var(--text-main)]">{label}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{desc}</p>
                  </div>
                ))}
              </div>
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
                      {/* Enhanced header — h-28 with constellation decoration */}
                      <div
                        className="relative h-28 overflow-hidden rounded-t-[16px] transition-all duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${world.cover_color}44, ${world.cover_color}11)`,
                        }}
                      >
                        <div
                          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          style={{
                            background: `linear-gradient(135deg, ${world.cover_color}70, ${world.cover_color}22)`,
                          }}
                        />
                        <div className="absolute inset-0 bg-grid opacity-15" />
                        <ConstellationDecoration color={world.cover_color} />
                        <p
                          className="absolute bottom-2 left-4 select-none font-heading text-7xl font-bold leading-none opacity-[0.09] transition-opacity duration-300 group-hover:opacity-[0.14]"
                          aria-hidden
                        >
                          {world.name[0]}
                        </p>
                        {world.genre && (
                          <div className="absolute right-3 top-2">
                            <Badge>{world.genre}</Badge>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 p-5">
                        <div>
                          <h3 className="font-heading text-2xl text-[var(--text-main)] transition-colors group-hover:text-[var(--accent)]">
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

                        {/* Lore progress bar */}
                        <div className="space-y-1">
                          <div className="h-0.5 overflow-hidden rounded-full bg-[var(--border)]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, (world.stats.lore / 50) * 100)}%`,
                                background: `linear-gradient(90deg, ${world.cover_color}, ${world.cover_color}88)`,
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] opacity-65" suppressHydrationWarning>
                            {world.stats.lore}/50 lore · Updated {formatRelative(world.updated_at)}
                          </p>
                        </div>
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

          <div className="glass-panel relative rounded-[14px]">
            {/* Vertical timeline line */}
            <div
              className="pointer-events-none absolute bottom-4 left-[27px] top-4 w-px"
              style={{ background: "linear-gradient(180deg, var(--border), transparent)" }}
            />
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                No activity yet. Start inscribing lore to see your progress here.
              </div>
            ) : (
              <div>
                {activityGroups.map((group, gi) => (
                  <div key={group.label}>
                    {(gi === 0 || group.label !== activityGroups[gi - 1]?.label) && (
                      <div className="sticky top-0 z-10 bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-4 pb-1 pt-3 backdrop-blur-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{group.label}</p>
                      </div>
                    )}
                    {group.items.map((item, i) => {
                      const Icon = activityIcons[item.type] ?? Clock;
                      return (
                        <motion.div
                          key={item.id}
                          className="group flex items-start gap-3 px-4 py-3 transition-[background] duration-150 hover:bg-[var(--surface)] last:rounded-b-[14px] cursor-default"
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 + (gi * 3 + i) * 0.04 }}
                        >
                          <div
                            className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-[var(--surface)] transition-transform duration-150 group-hover:scale-110"
                            style={{ background: typeColors[item.type] ?? "color-mix(in srgb, var(--ai-pulse) 10%, transparent)" }}
                          >
                            <Icon
                              className="h-3.5 w-3.5"
                              style={{ color: typeIconColors[item.type] ?? "var(--ai-pulse-soft)" }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--text-main)]">{item.title}</p>
                            <p className="truncate text-xs text-[var(--text-muted)]">{item.description}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <Link href={`/worlds/${item.world_id}`} className="text-[10px] text-[var(--accent)] hover:underline">
                                {item.world_name}
                              </Link>
                              <span className="text-[10px] text-[var(--text-muted)] opacity-65" suppressHydrationWarning>
                                {formatRelative(item.created_at)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
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
