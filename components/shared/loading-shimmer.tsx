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

// ── Summoning-circle geometry (viewBox 200×200, centre 100,100) ────────────
const RING_TICKS = Array.from({ length: 48 }, (_, i) => {
  const a = (i / 48) * Math.PI * 2;
  const major = i % 4 === 0;
  const inner = major ? 78 : 84;
  return {
    x1: 100 + Math.cos(a) * inner,
    y1: 100 + Math.sin(a) * inner,
    x2: 100 + Math.cos(a) * 90,
    y2: 100 + Math.sin(a) * 90,
    major,
  };
});

const RING_RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᛟ", "ᛞ", "ᛉ", "ᛊ"].map(
  (g, i, arr) => {
    const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
    return { g, x: 100 + Math.cos(a) * 66, y: 100 + Math.sin(a) * 66 };
  },
);

const CONVERGE = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { x: 100 + Math.cos(a) * 88, y: 100 + Math.sin(a) * 88, delay: i * 0.16 };
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
        className="relative h-64 w-64"
        initial={reduce ? undefined : { scale: 0.7, opacity: 0, rotate: -12 }}
        animate={reduce ? undefined : { scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
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

        {/* Radar sweep — a slow wedge of light raking the circle */}
        {!reduce && (
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <motion.div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--accent) 22%, transparent) 44deg, transparent 92deg)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4, ease: "linear", repeat: Infinity }}
            />
          </div>
        )}

        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" fill="none">
          <defs>
            <radialGradient id="sigil-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent-soft)" stopOpacity="0.95" />
              <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Faint base rings */}
          <circle cx="100" cy="100" r="90" stroke="color-mix(in srgb, var(--border) 70%, transparent)" strokeWidth="1" />
          <circle cx="100" cy="100" r="60" stroke="color-mix(in srgb, var(--border) 55%, transparent)" strokeWidth="1" />

          {/* Tick ring — slow clockwise dial */}
          <motion.g
            style={{ transformOrigin: "100px 100px" }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 24, ease: "linear", repeat: Infinity }}
          >
            {RING_TICKS.map((t, i) => (
              <line
                key={i}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke={t.major ? "var(--accent)" : "color-mix(in srgb, var(--accent) 45%, transparent)"}
                strokeWidth={t.major ? 1.4 : 0.7}
                strokeLinecap="round"
              />
            ))}
          </motion.g>

          {/* Outer ring — inscribes itself, then rotates */}
          <motion.circle
            cx="100" cy="100" r="90"
            stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
            style={{ transformOrigin: "100px 100px" }}
            initial={{ pathLength: 0, opacity: 0.3 }}
            animate={reduce ? { pathLength: 1, opacity: 0.9 } : { pathLength: [0, 1], opacity: [0.3, 0.95], rotate: 360 }}
            transition={
              reduce
                ? { duration: 0.4 }
                : {
                    pathLength: { duration: 2.4, ease: "easeInOut" },
                    opacity: { duration: 2.4, ease: "easeInOut" },
                    rotate: { duration: 18, ease: "linear", repeat: Infinity },
                  }
            }
          />

          {/* Rune ring — counter-rotating dial of glyphs */}
          <motion.g
            style={{ transformOrigin: "100px 100px" }}
            animate={reduce ? undefined : { rotate: -360 }}
            transition={{ duration: 20, ease: "linear", repeat: Infinity }}
          >
            {RING_RUNES.map((r, i) => (
              <text
                key={i}
                x={r.x} y={r.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize="11"
                fill="color-mix(in srgb, var(--accent) 75%, var(--text-muted))"
                style={{ fontFamily: "var(--font-crimson), serif" }}
              >
                {r.g}
              </text>
            ))}
          </motion.g>

          {/* Hexagram — two triangles drawing on, slowly counter-rotating */}
          <motion.g
            style={{ transformOrigin: "100px 100px" }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          >
            <motion.path
              d="M100,34 L157,133 L43,133 Z"
              stroke="var(--ai-pulse)" strokeWidth="1.4" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={reduce ? { pathLength: 1, opacity: 0.7 } : { pathLength: [0, 1], opacity: [0.2, 0.75] }}
              transition={{ duration: 2.2, ease: "easeInOut" }}
            />
            <motion.path
              d="M100,166 L43,67 L157,67 Z"
              stroke="var(--ai-pulse)" strokeWidth="1.4" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={reduce ? { pathLength: 1, opacity: 0.7 } : { pathLength: [0, 1], opacity: [0.2, 0.75] }}
              transition={{ duration: 2.2, ease: "easeInOut", delay: 0.2 }}
            />
          </motion.g>

          {/* Inner dashed ring — counter-rotating */}
          <motion.circle
            cx="100" cy="100" r="42"
            stroke="var(--accent-soft)" strokeWidth="1" strokeDasharray="2 10" opacity="0.6"
            style={{ transformOrigin: "100px 100px" }}
            animate={reduce ? undefined : { rotate: -360 }}
            transition={{ duration: 12, ease: "linear", repeat: Infinity }}
          />

          {/* Energy motes drawn inward to the core */}
          {!reduce &&
            CONVERGE.map((c, i) => (
              <motion.circle
                key={i}
                r="2.2" fill="var(--accent-soft)"
                initial={{ cx: c.x, cy: c.y, opacity: 0 }}
                animate={{ cx: [c.x, 100], cy: [c.y, 100], opacity: [0, 1, 0] }}
                transition={{ duration: 1.8, delay: c.delay, ease: "easeIn", repeat: Infinity }}
              />
            ))}

          {/* Shockwave pulses radiating out */}
          {!reduce &&
            [0, 1].map((i) => (
              <motion.circle
                key={i}
                cx="100" cy="100" r="34" fill="none"
                stroke="var(--accent)" strokeWidth="1.4"
                style={{ transformOrigin: "100px 100px" }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 2.4], opacity: [0.5, 0] }}
                transition={{ duration: 2.6, delay: i * 1.3, ease: "easeOut", repeat: Infinity }}
              />
            ))}

          {/* Pulsing core */}
          <motion.circle
            cx="100" cy="100" r="20" fill="url(#sigil-core)"
            style={{ transformOrigin: "100px 100px" }}
            animate={reduce ? undefined : { scale: [0.85, 1.15, 0.85], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
          />
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
