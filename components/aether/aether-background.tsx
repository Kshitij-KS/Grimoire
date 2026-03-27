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
    <div
      className="pointer-events-none fixed inset-0 z-0 transition-[background] duration-300"
      style={{
        background:
          "radial-gradient(540px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(165,148,255,0.06), transparent 34%)",
      }}
    />
  );
}
