"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current window scrollY value, updated on scroll.
 * Useful for triggering sticky header styles after a threshold.
 */
export function useScrollY(): number {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrollY;
}
