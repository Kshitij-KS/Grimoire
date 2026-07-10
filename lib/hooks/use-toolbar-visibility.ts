"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Controls toolbar visibility in immersive mode.
 *
 * When `enabled` is true (default), the toolbar shows on user activity
 * (mouse movement, key press, or touch) then hides after `timeoutMs`
 * milliseconds of inactivity. The timer resets when the user interacts
 * with the toolbar itself.
 *
 * When `enabled` is false, the toolbar stays pinned visible: it is forced
 * visible and no hide timer is ever scheduled.
 *
 * A passive `touchstart` window listener is registered alongside
 * `mousemove`/`keydown` so hidden toolbars can be re-summoned on touch
 * devices (Req 17.1, 17.2).
 */
export function useToolbarVisibility(timeoutMs = 3000, enabled = true) {
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    setIsVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // When auto-hide is disabled, keep the toolbar pinned — never schedule hide.
    if (!enabled) return;
    timerRef.current = setTimeout(() => setIsVisible(false), timeoutMs);
  }, [timeoutMs, enabled]);

  useEffect(() => {
    // When disabled, force the toolbar visible and skip activity wiring.
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsVisible(true);
      return;
    }

    const onActivity = () => resetTimer();
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, enabled]);

  return { isVisible, resetTimer };
}
