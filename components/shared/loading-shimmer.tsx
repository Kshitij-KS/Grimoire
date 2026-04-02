"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Legacy shimmer (unchanged) ────────────────────────────────────────────
type ShimmerVariant = "line" | "card" | "circle" | "panel";

interface LoadingShimmerProps {
  className?: string;
  variant?: ShimmerVariant;
}

const VARIANT_CLASSES: Record<ShimmerVariant, string> = {
  line: "h-4 rounded-lg",
  card: "h-24 rounded-[20px]",
  circle: "h-10 w-10 rounded-full",
  panel: "h-40 rounded-[24px]",
};

export function LoadingShimmer({ className, variant = "line" }: LoadingShimmerProps) {
  return (
    <div
      className={cn("shimmer", VARIANT_CLASSES[variant], className)}
      style={{
        background: `linear-gradient(90deg, color-mix(in srgb, var(--accent) 3%, transparent) 0%, color-mix(in srgb, var(--accent) 9%, transparent) 40%, color-mix(in srgb, var(--accent) 6%, transparent) 60%, color-mix(in srgb, var(--accent) 3%, transparent) 100%)`,
        backgroundSize: "200% 100%",
        animation: "shimmerWarm 2.1s linear infinite",
      }}
    />
  );
}

// ── Section loading screen ────────────────────────────────────────────────
export function SectionLoadingScreen({
  label = "Loading",
  subtitle = "",
}: {
  label?: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex min-h-[52vh] flex-col items-center justify-center gap-5 px-4"
    >
      {/* Spinner */}
      <div className="relative h-10 w-10">
        {/* Track */}
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 40 40"
          fill="none"
        >
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="color-mix(in srgb, var(--border) 80%, transparent)"
            strokeWidth="2.5"
          />
        </svg>
        {/* Animated arc */}
        <motion.svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 40 40"
          fill="none"
          animate={{ rotate: ["-90deg", "270deg"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="60 41"
            opacity="0.85"
          />
        </motion.svg>
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          {subtitle ? `${subtitle} · ` : ""}{label}
        </p>
      </div>
    </motion.div>
  );
}
