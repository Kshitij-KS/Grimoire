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

  const ringColor = isStreaming ? "rgba(212,168,83," : "rgba(124,92,191,";
  const coreColor = isStreaming ? "rgba(212,168,83,0.25)" : "rgba(124,92,191,0.2)";
  const glowColor = isStreaming ? "rgba(212,168,83," : "rgba(124,92,191,";
  const coreSize = isStreaming ? "52%" : "48%";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Outer slow ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: "100%",
          height: "100%",
          border: `1px solid ${ringColor}0.18)`,
          animation: "orbRing1 12s linear infinite",
        }}
      />
      {/* 4th ring — extra outer aura */}
      <div
        className="absolute rounded-full"
        style={{
          width: "125%",
          height: "125%",
          border: `1px solid ${ringColor}0.06)`,
          animation: "orbRing1 16s linear infinite reverse",
        }}
      />
      {/* Mid ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: "80%",
          height: "80%",
          border: `1px solid ${ringColor}0.28)`,
          animation: "orbRing2 8s linear infinite reverse",
        }}
      />
      {/* Inner ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: "60%",
          height: "60%",
          border: `1px solid ${ringColor}0.4)`,
          animation: "orbRing1 5s linear infinite",
        }}
      />

      {/* Core sphere */}
      <div
        className="relative rounded-full transition-all duration-700"
        style={{
          width: coreSize,
          height: coreSize,
          background: `radial-gradient(circle at 35% 35%, ${ringColor}0.6) 0%, ${coreColor} 50%, transparent 100%)`,
          boxShadow: `0 0 24px ${glowColor}0.45), 0 0 60px ${glowColor}0.15), inset 0 0 20px ${glowColor}0.15)`,
          border: `1px solid ${ringColor}0.45)`,
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
            background: `radial-gradient(circle, ${ringColor}0.7), transparent 80%)`,
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
          background: `radial-gradient(circle, ${glowColor}0.06) 0%, transparent 70%)`,
          animation: "orbAura 4s ease-in-out infinite",
        }}
      />

      {/* Forge-flare ring — shown on streaming start */}
      {showFlare && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            inset: "20%",
            border: `2px solid ${glowColor}0.7)`,
            animation: "forgeFlare 0.6s ease-out forwards",
          }}
        />
      )}
    </div>
  );
}

