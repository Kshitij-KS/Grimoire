"use client";

import { useEffect } from "react";

export function AetherBackground() {
  useEffect(() => {
    const updateMouse = (x: number, y: number) => {
      document.documentElement.style.setProperty("--mouse-x", `${x}px`);
      document.documentElement.style.setProperty("--mouse-y", `${y}px`);
    };

    const onMouseMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) updateMouse(touch.clientX, touch.clientY);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <>
      {/* Mouse-follow spotlight — ai-pulse tinted */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), color-mix(in srgb, var(--ai-pulse) 6%, transparent), transparent 38%)",
          transition: "opacity 0.3s ease",
        }}
      />
      {/* Ambient base layer — static atmospheric glow at bottom */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 110%, color-mix(in srgb, var(--ai-pulse) 4%, transparent), transparent 60%), radial-gradient(ellipse 40% 30% at 20% -10%, color-mix(in srgb, var(--accent) 3%, transparent), transparent 55%)",
        }}
      />
    </>
  );
}
