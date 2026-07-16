"use client";

import { motion, useReducedMotion } from "framer-motion";
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

// ── Section loading screen — "The Inscribing Sigil" ────────────────────────
// A themed transition animation shown while a world section mounts. A rune ring
// inscribes itself, an inner ring counter-rotates, ink-motes orbit, and a glyph
// breathes at the centre — enough motion to hold the eye while the heavy view
// (canvas / editor / graph) initialises behind it. Honours reduced-motion.

// Per-section glyph + flavour line, keyed by the section label the workspace
// passes in. Falls back gracefully for anything unmapped.
const SECTION_LORE: Record<string, { glyph: string; flavor: string }> = {
  Lore:           { glyph: "ᚱ", flavor: "Unfurling the Loom" },
  "World Bible":  { glyph: "ᛟ", flavor: "Charting the constellation" },
  Souls:          { glyph: "ᚨ", flavor: "Summoning the echoes" },
  Consistency:    { glyph: "ᛉ", flavor: "Focusing the lens" },
  Timeline:       { glyph: "ᛞ", flavor: "Weaving the tapestry" },
  Tavern:         { glyph: "ᚦ", flavor: "Gathering the souls" },
  Tools:          { glyph: "ᚷ", flavor: "Consulting the narrator" },
};

// Deterministic "dust mote" field for the full-screen backdrop — a lightweight
// pseudo-random spread so it looks scattered without pulling in a RNG or
// risking SSR hydration drift. Transform/opacity only, so it stays on the
// compositor and doesn't fight the heavy view mounting behind it.
const MOTES = Array.from({ length: 18 }, (_, i) => {
  const r = ((i * 9301 + 49297) % 233280) / 233280;
  const r2 = ((i * 4523 + 12345) % 233280) / 233280;
  return {
    left: 4 + r * 92,
    top: 6 + r2 * 88,
    size: 1.5 + r * 3,
    delay: r2 * 3,
    duration: 4.5 + r * 4.5,
    drift: r * 18 - 9,
  };
});

export function SectionLoadingScreen({
  label = "Loading",
  subtitle = "",
}: {
  label?: string;
  subtitle?: string;
}) {
  const reduce = useReducedMotion();
  const lore = SECTION_LORE[label] ?? { glyph: "✦", flavor: `Turning to ${label}` };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 overflow-hidden"
      style={{ background: "var(--bg)" }}
      aria-live="polite"
      aria-busy="true"
    >
      {/* Accent vignette glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 108%, color-mix(in srgb, var(--ai-pulse) 10%, transparent), transparent 60%)",
        }}
      />

      {/* Drifting dust motes */}
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {MOTES.map((m, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${m.left}%`,
                top: `${m.top}%`,
                width: m.size,
                height: m.size,
                background: "var(--accent-soft)",
              }}
              animate={{ opacity: [0, 0.7, 0], y: [0, -16, 0], x: [0, m.drift, 0] }}
              transition={{
                duration: m.duration,
                delay: m.delay,
                ease: "easeInOut",
                repeat: Infinity,
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        className="relative h-40 w-40"
        initial={reduce ? undefined : { scale: 0.85, opacity: 0 }}
        animate={reduce ? undefined : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Soft arcane glow */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--accent) 24%, transparent), transparent 70%)",
          }}
          animate={reduce ? undefined : { opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
        />

        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" fill="none">
          {/* Faint base ring */}
          <circle
            cx="60" cy="60" r="46"
            stroke="color-mix(in srgb, var(--border) 70%, transparent)"
            strokeWidth="1"
          />

          {/* Outer ring inscribing itself + slow spin */}
          <motion.circle
            cx="60" cy="60" r="46"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transformOrigin: "60px 60px" }}
            initial={{ pathLength: 0, opacity: 0.25 }}
            animate={
              reduce
                ? { pathLength: 1, opacity: 0.85 }
                : { pathLength: [0, 1, 0], opacity: [0.25, 0.95, 0.25], rotate: 360 }
            }
            transition={
              reduce
                ? { duration: 0.3 }
                : {
                    pathLength: { duration: 2.8, ease: "easeInOut", repeat: Infinity },
                    opacity: { duration: 2.8, ease: "easeInOut", repeat: Infinity },
                    rotate: { duration: 9, ease: "linear", repeat: Infinity },
                  }
            }
          />

          {/* Inner dashed ring, counter-rotating */}
          <motion.circle
            cx="60" cy="60" r="32"
            stroke="var(--ai-pulse)"
            strokeWidth="1"
            strokeDasharray="2 9"
            opacity="0.55"
            style={{ transformOrigin: "60px 60px" }}
            animate={reduce ? undefined : { rotate: -360 }}
            transition={{ duration: 7, ease: "linear", repeat: Infinity }}
          />

          {/* Orbiting ink-motes */}
          {!reduce &&
            [0, 1, 2].map((i) => (
              <motion.g
                key={i}
                style={{ transformOrigin: "60px 60px" }}
                initial={{ rotate: i * 120 }}
                animate={{ rotate: i * 120 + 360 }}
                transition={{ duration: 3.2 + i * 0.9, ease: "linear", repeat: Infinity }}
              >
                <circle
                  cx="60" cy="14" r={2.6 - i * 0.4}
                  fill="var(--accent-soft)"
                  opacity={0.9 - i * 0.18}
                />
              </motion.g>
            ))}
        </svg>

        {/* Breathing glyph at the centre */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={reduce ? undefined : { scale: [1, 1.14, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
        >
          <span className="font-heading text-5xl leading-none" style={{ color: "var(--accent)" }}>
            {lore.glyph}
          </span>
        </motion.div>
      </motion.div>

      {/* Flavour line + inking dots */}
      <div className="relative flex flex-col items-center gap-1.5 text-center">
        {subtitle && (
          <p
            className="text-[10px] font-bold uppercase tracking-[0.28em]"
            style={{ color: "color-mix(in srgb, var(--accent) 75%, var(--text-muted))" }}
          >
            {subtitle}
          </p>
        )}
        <p className="flex items-center font-heading text-2xl text-[var(--text-main)]">
          {lore.flavor}
          {!reduce && (
            <span className="ml-0.5 inline-flex">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.15, 1, 0.15] }}
                  transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity, delay: i * 0.2 }}
                >
                  .
                </motion.span>
              ))}
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}
