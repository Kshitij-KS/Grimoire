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
      className={cn(
        "shimmer",
        VARIANT_CLASSES[variant],
        className
      )}
      style={{
        background: `linear-gradient(90deg, color-mix(in srgb, var(--accent) 3%, transparent) 0%, color-mix(in srgb, var(--accent) 9%, transparent) 40%, color-mix(in srgb, var(--accent) 6%, transparent) 60%, color-mix(in srgb, var(--accent) 3%, transparent) 100%)`,
        backgroundSize: "200% 100%",
        animation: "shimmerWarm 2.1s linear infinite",
      }}
    />
  );
}

// ── Arcane runes used in loader ───────────────────────────────────────────
const LOADER_RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚷ", "ᚹ", "ᚺ"];

// ── Themed section loading screen ─────────────────────────────────────────
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
      className="flex min-h-[52vh] flex-col items-center justify-center gap-6 px-4"
    >
      {/* ── Central arcane orb ── */}
      <div className="relative flex items-center justify-center">
        {/* Outer slow pulse ring */}
        <motion.div
          className="absolute rounded-full border border-[color-mix(in_srgb,var(--ai-pulse)_22%,transparent)]"
          style={{ width: 130, height: 130 }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Middle glow ring */}
        <motion.div
          className="absolute rounded-full border border-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
          style={{ width: 90, height: 90 }}
          animate={{ scale: [1, 1.14, 1], opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />

        {/* Orbiting runes */}
        {LOADER_RUNES.map((rune, i) => {
          const angle = (i / LOADER_RUNES.length) * 360;
          const radius = 60;
          return (
            <motion.span
              key={i}
              className="pointer-events-none absolute font-heading text-sm select-none"
              style={{ color: i % 2 === 0 ? "color-mix(in srgb, var(--ai-pulse) 70%, transparent)" : "color-mix(in srgb, var(--accent) 55%, transparent)" }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 16 + i * 0.8,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <span
                style={{
                  display: "block",
                  transform: `rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)`,
                }}
              >
                {rune}
              </span>
            </motion.span>
          );
        })}

        {/* Inner glowing core */}
        <motion.div
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, var(--ai-pulse) 28%, transparent) 0%, color-mix(in srgb, var(--bg) 60%, transparent) 70%)`,
            border: "1px solid color-mix(in srgb, var(--ai-pulse) 35%, transparent)",
          }}
          animate={{
            boxShadow: [
              "0 0 22px color-mix(in srgb, var(--ai-pulse) 25%, transparent), inset 0 0 14px color-mix(in srgb, var(--ai-pulse) 12%, transparent)",
              "0 0 44px color-mix(in srgb, var(--ai-pulse) 45%, transparent), inset 0 0 24px color-mix(in srgb, var(--ai-pulse) 22%, transparent)",
              "0 0 22px color-mix(in srgb, var(--ai-pulse) 25%, transparent), inset 0 0 14px color-mix(in srgb, var(--ai-pulse) 12%, transparent)",
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="font-heading text-2xl text-[var(--accent)]" style={{ opacity: 0.7 }}>ᚷ</span>
        </motion.div>
      </div>

      {/* ── Text area ── */}
      <div className="flex flex-col items-center gap-1 text-center">
        <motion.p
          className="font-heading text-lg text-secondary"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {subtitle ? `${subtitle} · ` : ""}{label}
        </motion.p>
        {/* Travelling dots */}
        <div className="flex items-center gap-1.5 pt-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1 w-1 rounded-full bg-[color-mix(in_srgb,var(--ai-pulse)_60%,transparent)]"
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>

      {/* ── Horizontal shimmer bar ── */}
      <motion.div
        className="h-px w-40 rounded-full"
        style={{
          background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 35%, transparent), transparent)",
        }}
        animate={{ scaleX: [0.4, 1, 0.4], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
