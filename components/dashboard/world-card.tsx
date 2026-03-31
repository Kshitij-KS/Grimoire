"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenText, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WorldCardProps {
  world: {
    id: string;
    name: string;
    genre?: string | null;
    tone?: string | null;
    premise?: string | null;
    cover_color: string;
    stats: {
      loreEntries: number;
      souls: number;
      contradictions: number;
    };
  };
}

const statItems = [
  { icon: BookOpenText, color: "var(--accent)", key: "loreEntries" as const, label: "lore entries", hoverColor: "color-mix(in srgb, var(--accent) 12%, transparent)" },
  { icon: Users, color: "var(--ai-pulse)", key: "souls" as const, label: "bound souls", hoverColor: "color-mix(in srgb, var(--ai-pulse) 12%, transparent)" },
  { icon: ShieldAlert, color: "var(--danger)", key: "contradictions" as const, label: "open tensions", hoverColor: "color-mix(in srgb, var(--danger) 10%, transparent)" },
];

export function WorldCard({ world }: WorldCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
    >
      <div className="glass-panel group overflow-hidden rounded-[18px] transition-all duration-300 hover:border-[color-mix(in_srgb,var(--ai-pulse)_24%,transparent)] hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--ai-pulse)_10%,transparent)]">
        {/* ── Gradient header ── */}
        <div
          className="relative h-36 overflow-hidden rounded-t-[18px] transition-all duration-500"
          style={{
            background: `linear-gradient(135deg, ${world.cover_color}55 0%, ${world.cover_color}18 50%, ${world.cover_color}08 100%)`,
          }}
        >
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-grid opacity-20 transition-opacity duration-300 group-hover:opacity-30" />
          {/* Glow spot — shifts on hover */}
          <div
            className="absolute inset-0 transition-all duration-500"
            style={{
              background: `radial-gradient(circle at 30% 50%, ${world.cover_color}38, transparent 60%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at 65% 40%, ${world.cover_color}30, transparent 55%)`,
            }}
          />
          {/* Watermark world name */}
          <p
            className="absolute bottom-2 left-5 select-none font-heading text-7xl font-bold leading-none opacity-[0.07] transition-all duration-500 group-hover:opacity-[0.11]"
            aria-hidden
          >
            {world.name}
          </p>
          {/* Genre badge */}
          {world.genre ? (
            <div className="absolute right-4 top-3">
              <Badge>{world.genre}</Badge>
            </div>
          ) : null}
          {/* Color accent line at bottom of header */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] transition-opacity duration-300 group-hover:opacity-80"
            style={{ background: `linear-gradient(90deg, ${world.cover_color}cc, ${world.cover_color}44, transparent)` }}
          />
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="chapter-label">World</p>
            <h2 className="font-heading text-4xl text-foreground transition-colors duration-200 group-hover:text-[var(--silver)]">{world.name}</h2>
            <div className="flex flex-wrap gap-2">
              {world.tone ? <Badge variant="gold">{world.tone}</Badge> : null}
            </div>
            {world.premise ? (
              <p className="line-clamp-2 text-sm leading-7 text-secondary">
                {world.premise.slice(0, 90)}&hellip;
              </p>
            ) : null}
          </div>

          {/* Animated stat mini-cards */}
          <div className="grid gap-2.5 text-sm sm:grid-cols-3">
            {statItems.map(({ icon: Icon, color, key, label, hoverColor }, i) => (
              <div
                key={key}
                className="group/stat rounded-lg border border-border bg-[rgba(255,255,255,0.02)] p-3.5 transition-all duration-200"
                style={{
                  ['--stat-hover-bg' as string]: hoverColor,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = hoverColor;
                  (e.currentTarget as HTMLElement).style.borderColor = color.replace('rgb', 'rgba').replace(')', ',0.28)');
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                  (e.currentTarget as HTMLElement).style.borderColor = "";
                }}
              >
                <Icon className="mb-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover/stat:scale-110" style={{ color }} />
                <motion.p
                  key={world.stats[key]}
                  className="font-heading text-lg text-foreground"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.08 }}
                >
                  {world.stats[key]}
                </motion.p>
                <p className="text-[10px] text-secondary">{label}</p>
              </div>
            ))}
          </div>

          {/* CTA — arrow slides in on hover */}
          <Link
            href={`/worlds/${world.id}`}
            className="group/cta flex w-full items-center justify-between rounded-lg border border-border bg-[color-mix(in_srgb,var(--ai-pulse)_5%,transparent)] px-4 py-3 text-sm font-medium text-foreground transition-all duration-200 hover:border-[color-mix(in_srgb,var(--ai-pulse)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--ai-pulse)_10%,transparent)]"
          >
            <span>Enter World</span>
            <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover/cta:translate-x-0 group-hover/cta:opacity-100" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
