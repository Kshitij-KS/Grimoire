"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpenText, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  { icon: BookOpenText, color: "rgb(196,168,106)", key: "loreEntries" as const, label: "lore entries" },
  { icon: Users, color: "rgb(165,148,255)", key: "souls" as const, label: "bound souls" },
  { icon: ShieldAlert, color: "rgb(210,90,90)", key: "contradictions" as const, label: "open tensions" },
];

export function WorldCard({ world }: WorldCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <div className="glass-panel hoverable-card group overflow-hidden rounded-[32px] transition-all duration-300">
        {/* ── Gradient header ── */}
        <div
          className="relative h-32 overflow-hidden rounded-t-[32px]"
          style={{
            background: `linear-gradient(135deg, ${world.cover_color}44, ${world.cover_color}11)`,
          }}
        >
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-grid opacity-20" />
          {/* Glow spot */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 30% 50%, ${world.cover_color}28, transparent 60%)`,
            }}
          />
          {/* Watermark world name */}
          <p
            className="absolute bottom-2 left-5 select-none font-heading text-7xl font-bold leading-none opacity-[0.07]"
            aria-hidden
          >
            {world.name}
          </p>
          {/* Genre badge top-right */}
          {world.genre ? (
            <div className="absolute right-4 top-3">
              <Badge>{world.genre}</Badge>
            </div>
          ) : null}
          {/* Color accent line at bottom of header */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, ${world.cover_color}88, transparent)` }}
          />
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="chapter-label">World</p>
            <h2 className="font-heading text-4xl text-foreground">{world.name}</h2>
            <div className="flex flex-wrap gap-2">
              {world.tone ? <Badge variant="gold">{world.tone}</Badge> : null}
            </div>
            {world.premise ? (
              <p className="line-clamp-2 text-sm leading-7 text-secondary">
                {world.premise.slice(0, 90)}&hellip;
              </p>
            ) : null}
          </div>

          {/* Animated stats */}
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            {statItems.map(({ icon: Icon, color, key, label }, i) => (
              <div
                key={key}
                className="rounded-2xl border border-border bg-[rgba(255,255,255,0.025)] p-4"
              >
                <Icon className="mb-2 h-4 w-4" style={{ color }} />
                <motion.p
                  key={world.stats[key]}
                  className="font-medium text-foreground"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.08 }}
                >
                  {world.stats[key]}
                </motion.p>
                <p className="text-xs text-secondary">{label}</p>
              </div>
            ))}
          </div>

          <Button asChild className="w-full">
            <Link href={`/worlds/${world.id}`}>Enter World</Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
