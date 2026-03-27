"use client";

import { useEffect, useRef } from "react";

// Warm ember / dust particle palette
const AMBER_COLORS = ["212,168,83", "240,192,96", "232,168,64"];
const PURPLE_COLORS = ["157,127,224", "180,157,232"];

export function AmbientParticles({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let frame = 0;
    let paused = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    // Debounced resize to avoid jank during drag-resize
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };

    resize();
    window.addEventListener("resize", onResize);

    // Pause when tab is not visible to save CPU
    const onVisibility = () => {
      paused = document.hidden;
      if (!paused) draw();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const particles = Array.from({ length: 48 }, (_, i) => {
      const isAmber = Math.random() < 0.65;
      const palette = isAmber ? AMBER_COLORS : PURPLE_COLORS;
      // Some particles drift upward like rising embers
      const driftsUp = isAmber && Math.random() < 0.4;
      return {
        x: Math.random() * (canvas.width || window.innerWidth),
        y: Math.random() * (canvas.height || window.innerHeight),
        radius: Math.random() * 2.2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.09,
        speedY: driftsUp ? -(Math.random() * 0.07 + 0.03) : (Math.random() - 0.5) * 0.08,
        hue: palette[Math.floor(Math.random() * palette.length)],
        alpha: Math.random() * 0.3 + 0.1,
        phase: i * 0.6, // unique wave phase per particle
      };
    });

    const draw = () => {
      if (paused) return;

      frame += 0.003;
      context.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.speedX + Math.sin(frame + p.phase) * 0.025;
        p.y += p.speedY + Math.cos(frame + p.phase * 0.7) * 0.025;

        // Wrap edges
        if (p.x < -4) p.x = canvas.width + 4;
        if (p.x > canvas.width + 4) p.x = -4;
        if (p.y < -4) p.y = canvas.height + 4;
        if (p.y > canvas.height + 4) p.y = -4;

        context.beginPath();
        context.fillStyle = `rgba(${p.hue}, ${p.alpha})`;
        context.shadowBlur = 14;
        context.shadowColor = `rgba(${p.hue}, 0.28)`;
        context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        context.fill();
      });

      frameId = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}
