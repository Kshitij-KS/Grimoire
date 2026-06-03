"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWorkspaceStore } from "@/lib/store";

/**
 * Returns true when usage has reached 80% of the daily limit.
 * Exported independently for use outside of React components.
 */
export function isNearLimit(count: number, limit: number): boolean {
  if (limit <= 0) return false;
  return count >= Math.ceil(limit * 0.8);
}

/**
 * Returns the number of remaining uses before the limit is exhausted.
 * Exported independently for use outside of React components.
 */
export function remainingUses(count: number, limit: number): number {
  return Math.max(0, limit - count);
}

/**
 * Returns the current UTC day as an integer (0-based day of year would be complex,
 * so we use the date string YYYY-MM-DD for reliable day change detection).
 */
function getCurrentUTCDay(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Hook that manages rate limit status in the workspace store.
 *
 * - Exposes `isNearLimit` and `remainingUses` helpers bound to the store state
 * - Polls every 60 seconds to detect UTC midnight day change
 * - Calls `onDayChange` callback when a new UTC day is detected, allowing
 *   the consumer to refetch rate limits from the API
 */
export function useRateLimitStatus(onDayChange?: () => void) {
  const rateLimits = useWorkspaceStore((s) => s.rateLimits);
  const setRateLimits = useWorkspaceStore((s) => s.setRateLimits);
  const lastUTCDay = useRef<string>(getCurrentUTCDay());

  // Midnight reset detection: poll every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDay = getCurrentUTCDay();
      if (currentDay !== lastUTCDay.current) {
        lastUTCDay.current = currentDay;
        // Reset local rate limits on day change
        const resetLimits: Record<string, { count: number; limit: number }> = {};
        for (const [key, entry] of Object.entries(rateLimits)) {
          resetLimits[key] = { count: 0, limit: entry.limit };
        }
        setRateLimits(resetLimits);
        // Notify consumer to refetch from API
        onDayChange?.();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [rateLimits, setRateLimits, onDayChange]);

  /**
   * Check if a specific action is near its limit.
   */
  const isActionNearLimit = useCallback(
    (action: string): boolean => {
      const entry = rateLimits[action];
      if (!entry) return false;
      return isNearLimit(entry.count, entry.limit);
    },
    [rateLimits],
  );

  /**
   * Get remaining uses for a specific action.
   */
  const actionRemainingUses = useCallback(
    (action: string): number => {
      const entry = rateLimits[action];
      if (!entry) return Infinity;
      return remainingUses(entry.count, entry.limit);
    },
    [rateLimits],
  );

  /**
   * Check if a specific action's limit is fully exhausted.
   */
  const isLimitExhausted = useCallback(
    (action: string): boolean => {
      const entry = rateLimits[action];
      if (!entry) return false;
      return entry.count >= entry.limit;
    },
    [rateLimits],
  );

  return {
    rateLimits,
    setRateLimits,
    isActionNearLimit,
    actionRemainingUses,
    isLimitExhausted,
  };
}
