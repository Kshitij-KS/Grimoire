"use client";

import { motion } from "framer-motion";
import { BookOpen, Clock, Eye, Feather, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type EmptyStateVariant = "lore" | "archive" | "souls" | "consistency" | "tapestry" | "tavern" | "default";

interface EmptyStateProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  onClick?: () => void;
  variant?: EmptyStateVariant;
}

const VARIANTS: Record<
  EmptyStateVariant,
  { Icon: React.ComponentType<{ className?: string }>; title: string; description: string }
> = {
  lore: {
    Icon: Feather,
    title: "The page awaits.",
    description: "No lore written yet. Begin your world's first scroll — every word becomes living memory.",
  },
  archive: {
    Icon: BookOpen,
    title: "The archive is silent.",
    description: "No entities have emerged yet. Write characters, places, and factions into the lore and they will appear here.",
  },
  souls: {
    Icon: Users,
    title: "No souls are bound.",
    description: "Write characters into the lore, then forge them into bound souls who can speak in their own voice.",
  },
  consistency: {
    Icon: Eye,
    title: "The world holds.",
    description: "No contradictions have been flagged. The archive remembers clearly.",
  },
  tapestry: {
    Icon: Clock,
    title: "The threads are unspun.",
    description: "Write events into your lore and the Oracle will weave them into a timeline here.",
  },
  tavern: {
    Icon: Users,
    title: "The Tavern sits empty.",
    description: "Forge at least two souls to gather them here and watch them speak.",
  },
  default: {
    Icon: Sparkles,
    title: "Nothing here yet.",
    description: "Begin to fill this space.",
  },
};

export function EmptyState({
  title,
  description,
  ctaLabel,
  onClick,
  variant = "default",
}: EmptyStateProps) {
  const preset = VARIANTS[variant];
  const Icon = preset.Icon;
  const displayTitle = title ?? preset.title;
  const displayDescription = description ?? preset.description;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="flex min-h-[280px] flex-col items-center justify-center gap-5 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--ai-pulse)_10%,transparent)]">
          <span className="pointer-events-none absolute select-none font-heading text-4xl opacity-[0.06] text-[var(--accent)]" aria-hidden>ᚷ</span>
          <Icon className="relative z-10 h-7 w-7 text-[var(--accent)]" />
        </div>
        <div className="space-y-2">
          <h3 className="font-heading text-3xl italic text-[var(--text-main)]">{displayTitle}</h3>
          <p className="max-w-lg text-sm leading-7 text-secondary">{displayDescription}</p>
        </div>
        {ctaLabel ? (
          <Button onClick={onClick}>{ctaLabel}</Button>
        ) : null}
      </Card>
    </motion.div>
  );
}
