"use client";

import { motion } from "framer-motion";
import { BookOpen, Eye, Feather, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type EmptyStateVariant = "lore" | "archive" | "souls" | "consistency" | "default";

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
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,168,83,0.24)] bg-[rgba(124,92,191,0.1)]">
          <Icon className="h-7 w-7 text-[rgb(212,168,83)]" />
        </div>
        <div className="space-y-2">
          <h3 className="font-heading text-3xl italic text-[rgb(240,234,216)]">{displayTitle}</h3>
          <p className="max-w-lg text-sm leading-7 text-secondary">{displayDescription}</p>
        </div>
        {ctaLabel ? (
          <Button onClick={onClick}>{ctaLabel}</Button>
        ) : null}
      </Card>
    </motion.div>
  );
}
