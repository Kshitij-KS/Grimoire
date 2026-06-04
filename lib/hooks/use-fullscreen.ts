"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages fullscreen state with graceful degradation.
 * When the Fullscreen API is unavailable or rejected, falls back to
 * a CSS-only approach (signaled via `isCssFallback`) and logs a warning
 * to the console — no user-facing error is surfaced.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCssFallback, setIsCssFallback] = useState(false);
  const cssFallbackRef = useRef(false);

  // Sync state from native fullscreenchange events
  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      // If we exit native fullscreen, clear CSS fallback too
      if (!active) {
        setIsCssFallback(false);
        cssFallbackRef.current = false;
      }
    };

    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enter = useCallback(async () => {
    // Already fullscreen (native or CSS fallback)
    if (document.fullscreenElement || cssFallbackRef.current) return;

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        // State is set by the fullscreenchange event listener
      } else {
        // API unavailable — fall back to CSS
        console.warn(
          "[useFullscreen] Fullscreen API unavailable. Falling back to CSS-based fullscreen."
        );
        setIsCssFallback(true);
        cssFallbackRef.current = true;
        setIsFullscreen(true);
      }
    } catch (err) {
      // API rejected (permissions policy, user gesture requirement, etc.)
      console.warn(
        "[useFullscreen] requestFullscreen() rejected. Falling back to CSS-based fullscreen.",
        err
      );
      setIsCssFallback(true);
      cssFallbackRef.current = true;
      setIsFullscreen(true);
    }
  }, []);

  const exit = useCallback(async () => {
    if (cssFallbackRef.current) {
      // Exit CSS fallback mode
      setIsCssFallback(false);
      cssFallbackRef.current = false;
      setIsFullscreen(false);
      return;
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        // State is set by the fullscreenchange event listener
      } catch {
        // If exit fails for some reason, just reset state
        setIsFullscreen(false);
      }
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isFullscreen) {
      await exit();
    } else {
      await enter();
    }
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, isCssFallback, enter, exit, toggle };
}
