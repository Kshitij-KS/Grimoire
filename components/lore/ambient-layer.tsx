"use client";

interface AmbientLayerProps {
  intensity: "subtle" | "medium" | "vivid";
  enabled: boolean;
}

const INTENSITY_SCALE: Record<AmbientLayerProps["intensity"], number> = {
  subtle: 1,
  medium: 1.5,
  vivid: 2.5,
};

/**
 * AmbientLayer — purely decorative atmospheric effects for immersive writing mode.
 *
 * Renders three fixed-position layers:
 * 1. Vignette: radial gradient darkening edges
 * 2. Atmosphere: animated gradient color shifts (CSS-only, 30s cycle)
 * 3. Grain: SVG noise texture overlay
 *
 * All layers use pointer-events: none and respect prefers-reduced-motion.
 */
export function AmbientLayer({ intensity, enabled }: AmbientLayerProps) {
  if (!enabled) return null;

  const scale = INTENSITY_SCALE[intensity];

  return (
    <>
      {/* Vignette — darkens viewport edges */}
      <div
        className="fixed inset-0 pointer-events-none z-[1]"
        aria-hidden="true"
        style={{
          background: `radial-gradient(
            ellipse 70% 60% at 50% 50%,
            transparent 40%,
            color-mix(in srgb, var(--bg) 90%, black) 100%
          )`,
          opacity: Math.min(1, 1 * scale),
        }}
      />

      {/* Atmosphere — subtle animated color shifts */}
      <div
        className="fixed inset-0 pointer-events-none z-[0] motion-safe:animate-[atmosphereShift_30s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 50% 40% at 20% 80%, color-mix(in srgb, var(--accent) 4%, transparent), transparent),
            radial-gradient(ellipse 40% 30% at 80% 20%, color-mix(in srgb, var(--ai-pulse) 3%, transparent), transparent)
          `,
          opacity: Math.min(1, 0.7 * scale),
        }}
      />

      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[2] motion-safe:animate-none motion-reduce:animate-none"
        aria-hidden="true"
        style={{
          opacity: Math.min(0.075, 0.018 * scale),
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          mixBlendMode: "overlay",
        }}
      />
    </>
  );
}
