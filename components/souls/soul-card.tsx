"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingShimmer } from "@/components/shared/loading-shimmer";
import { initialsFromName } from "@/lib/utils";
import type { Soul } from "@/lib/types";

export function SoulCard({
  soul,
  worldId,
  isDemo = false,
  onView,
  onDelete,
}: {
  soul: Soul;
  worldId: string;
  isDemo?: boolean;
  onView: () => void;
  onDelete?: (id: string) => void;
}) {
  const isGenerating = !soul.soul_card;
  const color = soul.avatar_color ?? "rgb(124,92,191)";
  const initials = soul.avatar_initials ?? initialsFromName(soul.name);
  const sampleLines = soul.soul_card?.sample_lines ?? [];

  return (
    <motion.div
      className="group"
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
    >
      <Card className="relative flex flex-col overflow-hidden rounded-[16px] p-0">
        {/* ── Avatar section ── */}
        <div
          className="relative flex h-44 items-center justify-center overflow-hidden"
          style={{
            background: `radial-gradient(circle at 50% 60%, ${color}28, transparent 70%)`,
          }}
        >
          {/* Color accent top line */}
          <div
            className="absolute inset-x-0 top-0 h-[2px] opacity-55 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: `linear-gradient(90deg, ${color}dd, ${color}44, transparent)` }}
          />
          {/* Subtle grid overlay */}
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-15" />

          {/* Watermark initial */}
          <span
            className="pointer-events-none absolute select-none font-heading text-[7rem] font-bold opacity-[0.04]"
            style={{ color }}
            aria-hidden
          >
            {initials.slice(0, 1)}
          </span>

          <Avatar
            className="soul-glow-ring relative z-10 h-24 w-24 border-2 transition-transform duration-300 group-hover:scale-105"
            style={{
              borderColor: color,
              boxShadow: `0 0 32px ${color}44`,
            }}
          >
            <AvatarFallback
              className="font-heading text-2xl"
              style={{ background: `${color}22`, color }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Animated pulse ring while generating */}
          {isGenerating && (
            <span
              className="absolute inset-[26px] rounded-full border-2 animate-ping opacity-25 z-20"
              style={{ borderColor: color }}
            />
          )}

          {/* Delete button — top-right corner, appears on hover */}
          {!isDemo && onDelete && (
            <button
              className="absolute right-3 top-3 z-20 rounded-lg p-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100"
              style={{
                background: "rgba(192,74,74,0.12)",
                color: "rgba(192,74,74,0.70)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(192,74,74,0.22)";
                (e.currentTarget as HTMLElement).style.color = "rgb(192,74,74)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(192,74,74,0.12)";
                (e.currentTarget as HTMLElement).style.color = "rgba(192,74,74,0.70)";
              }}
              onClick={(e) => { e.preventDefault(); onDelete(soul.id); }}
              title="Release this soul"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── Name + voice ── */}
        <div className="px-5 pt-4 pb-2">
          <h3 className="font-heading text-3xl leading-tight text-foreground">{soul.name}</h3>
          {isGenerating ? (
            <div className="mt-2 space-y-1.5">
              <LoadingShimmer className="h-3 w-full rounded-full" />
              <LoadingShimmer className="h-3 w-3/4 rounded-full" />
            </div>
          ) : (
            <p className="mt-1 line-clamp-2 text-sm italic leading-6 text-secondary">
              {soul.soul_card?.voice ?? "Soul card shaping..."}
            </p>
          )}
        </div>

        {/* ── Sample lines — softly visible at rest, fully revealed on hover ── */}
        <div className="min-h-[48px] overflow-hidden px-5 pb-2">
          <div className="translate-y-0.5 opacity-40 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-90">
            {sampleLines.slice(0, 2).map((line, i) => (
              <p key={i} className="mb-1 truncate text-xs italic text-secondary/70">
                &ldquo;{line}&rdquo;
              </p>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mt-auto border-t border-border px-5 py-4">
          {isGenerating ? (
            <LoadingShimmer className="h-9 w-full rounded-[10px]" />
          ) : (
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link href={`/worlds/${worldId}/souls/${soul.id}/chat`}>Chat</Link>
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={onView}>
                Soul Card
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
