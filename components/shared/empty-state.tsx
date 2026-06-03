"use client";

import { motion } from "framer-motion";
import { BookOpen, Clock, Eye, Feather, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type EmptyStateVariant = "lore" | "archive" | "souls" | "consistency" | "tapestry" | "tavern" | "default";

interface EmptyStateProps {
  /** A React node to render as the section icon (typically a lucide-react icon element) */
  icon?: React.ReactNode;
  /** The heading displayed in the empty state */
  heading?: string;
  /** A descriptive paragraph (max 280 characters) */
  description?: string;
  /** Label for the call-to-action button */
  ctaLabel?: string;
  /** Callback when the CTA button is clicked */
  ctaAction?: () => void;
  /**
   * Predefined variant that supplies default icon, heading, and description.
   * Props passed explicitly will override variant defaults.
   */
  variant?: EmptyStateVariant;
  /** @deprecated Use `heading` instead */
  title?: string;
  /** @deprecated Use `ctaAction` instead */
  onClick?: () => void;
}

const VARIANTS: Record<
  EmptyStateVariant,
  { icon: React.ReactNode; heading: string; description: string }
> = {
  lore: {
    icon: <Feather className="relative z-10 h-7 w-7 text-[var(--accent)]" />,
    heading: "The page awaits.",
    description: "No lore written yet. Begin your world's first scroll — every word becomes living memory.",
  },
  archive: {
    icon: <BookOpen className="relative z-10 h-7 w-7 text-[var(--accent)]" />,
    heading: "The archive is silent.",
    description: "No entities have emerged yet. Write characters, places, and factions into the lore and they will appear here.",
  },
  souls: {
    icon: <Users className="relative z-10 h-7 w-7 text-[var(--accent)]" />,
    heading: "No souls are bound.",
    description: "Write characters into the lore, then forge them into bound souls who can speak in their own voice.",
  },
  consistency: {
    icon: <Eye className="relative z-10 h-7 w-7 text-[var(--accent)]" />,
    heading: "The world holds.",
    description: "No contradictions have been flagged. The archive remembers clearly.",
  },
  tapestry: {
    icon: <Clock className="relative z-10 h-7 w-7 text-[var(--accent)]" />,
    heading: "The threads are unspun.",
    description: "Write events into your lore and the Oracle will weave them into a timeline here.",
  },
  tavern: {
    icon: <Users className="relative z-10 h-7 w-7 text-[var(--accent)]" />,
    heading: "The Tavern sits empty.",
    description: "Forge at least two souls to gather them here and watch them speak.",
  },
  default: {
    icon: <Sparkles className="relative z-10 h-7 w-7 text-[var(--accent)]" />,
    heading: "Nothing here yet.",
    description: "Begin to fill this space.",
  },
};

export function EmptyState({
  icon,
  heading,
  description,
  ctaLabel,
  ctaAction,
  variant = "default",
  // Legacy prop support
  title,
  onClick,
}: EmptyStateProps) {
  const preset = VARIANTS[variant];

  // Resolve final values: explicit props > legacy props > variant defaults
  const resolvedIcon = icon ?? preset.icon;
  const resolvedHeading = heading ?? title ?? preset.heading;
  const resolvedDescription = description ?? preset.description;
  const resolvedAction = ctaAction ?? onClick;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="flex min-h-[280px] flex-col items-center justify-center gap-5 border border-[color-mix(in_srgb,var(--border)_60%,transparent)] text-center">
        {/* Decorative icon container */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--ai-pulse)_10%,transparent)]">
          <span
            className="pointer-events-none absolute select-none font-heading text-4xl opacity-[0.06] text-[var(--accent)]"
            aria-hidden="true"
          >
            ᚷ
          </span>
          {resolvedIcon}
        </div>

        {/* Text content */}
        <div className="space-y-2 px-4">
          <h3 className="font-heading text-3xl italic text-[var(--text-main)]">
            {resolvedHeading}
          </h3>
          <p className="mx-auto max-w-lg text-sm leading-7 text-[var(--text-muted)]">
            {resolvedDescription}
          </p>
        </div>

        {/* CTA button */}
        {ctaLabel ? (
          <Button variant="gold" onClick={resolvedAction}>
            {ctaLabel}
          </Button>
        ) : null}

        {/* Decorative bottom accent line */}
        <div
          className="mt-2 h-px w-24 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-30"
          aria-hidden="true"
        />
      </Card>
    </motion.div>
  );
}
