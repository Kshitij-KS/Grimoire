"use client";

import { useEffect, useRef, useState } from "react";

// Pure CSS animated arcane orb — keyframes live in globals.css
export function EchoesOrb({ isStreaming }: { isStreaming: boolean }) {
  const [showFlare, setShowFlare] = useState(false);
  const prevStreaming = useRef(false);

  // Trigger forge-flare ring on streaming start (false → true transition)
  useEffect(() => {
    if (isStreaming && !prevStreaming.current) {
      setShowFlare(true);
      const t = setTimeout(() => setShowFlare(false), 600);
      prevStreaming.current = true;
      return () => clearTimeout(t);
    }
    if (!isStreaming) {
      prevStreaming.current = false;
    }
  }, [isStreaming]);

  // Use CSS variables — streaming = accent, idle = ai-pulse
  const colorVar = isStreaming ? "var(--accent)" : "var(--ai-pulse)";
  const ring18 = `color-mix(in srgb, ${colorVar} 18%, transparent)`;
  const ring06 = `color-mix(in srgb, ${colorVar} 6%, transparent)`;
  const ring28 = `color-mix(in srgb, ${colorVar} 28%, transparent)`;
  const ring40 = `color-mix(in srgb, ${colorVar} 40%, transparent)`;
  const ring45 = `color-mix(in srgb, ${colorVar} 45%, transparent)`;
  const ring60 = `color-mix(in srgb, ${colorVar} 60%, transparent)`;
  const ring70 = `color-mix(in srgb, ${colorVar} 70%, transparent)`;
  const core20 = `color-mix(in srgb, ${colorVar} 20%, transparent)`;
  const glow45 = `color-mix(in srgb, ${colorVar} 45%, transparent)`;
  const glow15 = `color-mix(in srgb, ${colorVar} 15%, transparent)`;
  const glow06 = `color-mix(in srgb, ${colorVar} 6%, transparent)`;
  const coreSize = isStreaming ? "52%" : "48%";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Outer slow ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: "100%",
          height: "100%",
          border: `1px solid ${ring18}`,
          animation: "orbRing1 12s linear infinite",
        }}
      />
      {/* 4th ring — extra outer aura */}
      <div
        className="absolute rounded-full"
        style={{
          width: "125%",
          height: "125%",
          border: `1px solid ${ring06}`,
          animation: "orbRing1 16s linear infinite reverse",
        }}
      />
      {/* Mid ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: "80%",
          height: "80%",
          border: `1px solid ${ring28}`,
          animation: "orbRing2 8s linear infinite reverse",
        }}
      />
      {/* Inner ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: "60%",
          height: "60%",
          border: `1px solid ${ring40}`,
          animation: "orbRing1 5s linear infinite",
        }}
      />

      {/* Core sphere */}
      <div
        className="relative rounded-full transition-all duration-700"
        style={{
          width: coreSize,
          height: coreSize,
          background: `radial-gradient(circle at 35% 35%, ${ring60} 0%, ${core20} 50%, transparent 100%)`,
          boxShadow: `0 0 24px ${glow45}, 0 0 60px ${glow15}, inset 0 0 20px ${glow15}`,
          border: `1px solid ${ring45}`,
          animation: "orbCorePulse 3s ease-in-out infinite",
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute rounded-full"
          style={{
            top: "18%",
            left: "22%",
            width: "28%",
            height: "20%",
            background: `radial-gradient(circle, ${ring70}, transparent 80%)`,
            filter: "blur(2px)",
          }}
        />
      </div>

      {/* Ambient aura */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: "110%",
          height: "110%",
          background: `radial-gradient(circle, ${glow06} 0%, transparent 70%)`,
          animation: "orbAura 4s ease-in-out infinite",
        }}
      />

      {/* Forge-flare ring — shown on streaming start */}
      {showFlare && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            inset: "20%",
            border: `2px solid ${ring70}`,
            animation: "forgeFlare 0.6s ease-out forwards",
          }}
        />
      )}
    </div>
  );
}
