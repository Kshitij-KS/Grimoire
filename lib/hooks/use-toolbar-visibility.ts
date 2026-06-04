"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Controls toolbar visibility in immersive mode.
 * Shows the toolbar on user activity (mouse movement or key press),
 * then hides it after `timeoutMs` milliseconds of inactivity.
 * The timer resets when the user interacts with the toolbar itself.
 */
export function useToolbarVisibility(timeoutMs = 3000) {
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    setIsVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsVisible(false), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    const onActivity = () => resetTimer();
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  return { isVisible, resetTimer };
}
