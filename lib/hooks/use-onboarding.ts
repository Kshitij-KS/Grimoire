"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "@/lib/onboarding-steps";

interface UseOnboardingOptions {
  userId: string | null;
  worldId: string | null;
}

interface UseOnboardingReturn {
  currentStep: number;
  completedSteps: [boolean, boolean, boolean, boolean];
  isFinished: boolean;
  isDismissed: boolean;
  completeStep: (index: number) => void;
  dismiss: () => void;
  resume: () => void;
}

/**
 * Hook managing onboarding step state, completion detection, dismiss/resume,
 * and server persistence to profiles.onboarding_state.
 */
export function useOnboarding({
  userId,
  worldId,
}: UseOnboardingOptions): UseOnboardingReturn {
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [loaded, setLoaded] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number | null>(null);

  // ── Fetch onboarding state from profiles on mount ──
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function fetchState() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_state")
          .eq("id", userId)
          .single();

        if (!cancelled && data?.onboarding_state) {
          const persisted = data.onboarding_state as OnboardingState;
          setState(persisted);
        }
      } catch {
        // If fetch fails, keep default state
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchState();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Persist state to profiles.onboarding_state on every change ──
  // Always writes the LATEST state. (The previous version guarded with a
  // "persisting" ref that could drop the final write — e.g. a dismiss — if two
  // state changes landed close together.)
  useEffect(() => {
    if (!userId || !loaded) return;
    let cancelled = false;

    async function persist() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_state: state })
          .eq("id", userId);
        // Surface a real failure (e.g. the onboarding_state column not existing
        // in this database) instead of hiding it — this is the difference
        // between "dismiss sticks" and "panel returns on every refresh".
        if (error && !cancelled) {
          console.error("[onboarding] failed to persist state:", error.message);
        }
      } catch (e) {
        if (!cancelled) console.error("[onboarding] persist threw:", e);
      }
    }

    persist();
    return () => {
      cancelled = true;
    };
  }, [userId, state, loaded]);

  // ── Complete a step ──
  const completeStep = useCallback(
    (index: number) => {
      if (index < 0 || index > 3) return;

      setState((prev) => {
        if (prev.finished) return prev;
        if (prev.completedSteps[index]) return prev;

        const newCompleted = [...prev.completedSteps] as [
          boolean,
          boolean,
          boolean,
          boolean,
        ];
        newCompleted[index] = true;

        const allDone = newCompleted.every(Boolean);

        // Advance currentStep to next incomplete step
        let nextStep = prev.currentStep;
        if (!allDone) {
          for (let i = 0; i < 4; i++) {
            if (!newCompleted[i]) {
              nextStep = i;
              break;
            }
          }
        }

        return {
          currentStep: nextStep,
          completedSteps: newCompleted,
          dismissed: prev.dismissed,
          finished: allDone,
        };
      });
    },
    [],
  );

  // ── Dismiss onboarding (record current step as resume point) ──
  const dismiss = useCallback(() => {
    setState((prev) => {
      if (prev.finished) return prev;
      return { ...prev, dismissed: true };
    });
  }, []);

  // ── Resume onboarding from first incomplete step ──
  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.finished) return prev;

      // Find first incomplete step
      let resumeStep = 0;
      for (let i = 0; i < 4; i++) {
        if (!prev.completedSteps[i]) {
          resumeStep = i;
          break;
        }
      }

      return { ...prev, dismissed: false, currentStep: resumeStep };
    });
  }, []);

  // NOTE: dismissal is now respected across reloads. The panel stays hidden
  // once dismissed (or once finished); `resume()` is exposed for an explicit
  // "restart the tour" affordance rather than firing automatically on load,
  // which is what made the panel reappear on every refresh.

  // ── Step 2 polling: check for entities every 3s for up to 60s ──
  useEffect(() => {
    if (!loaded || !worldId || !userId) return;
    if (state.finished) return;
    if (state.completedSteps[1]) return; // Already completed step 2
    if (state.currentStep !== 1) return; // Only poll when on step 2

    // Start polling for entities
    pollingStartRef.current = Date.now();

    async function checkEntities() {
      try {
        const response = await fetch(
          `/api/entities?worldId=${worldId}`,
        );
        if (response.ok) {
          // GET /api/entities returns `{ entities: [...] }`, not a bare array.
          // The old code checked Array.isArray() on the object and so never
          // detected extracted entities → step 2 never auto-completed.
          const json = await response.json();
          const list = Array.isArray(json) ? json : json?.entities;
          if (Array.isArray(list) && list.length > 0) {
            completeStep(1);
            stopPolling();
          }
        }
      } catch {
        // Silent failure on poll
      }

      // Stop after 60 seconds
      if (
        pollingStartRef.current &&
        Date.now() - pollingStartRef.current >= 60_000
      ) {
        stopPolling();
      }
    }

    function stopPolling() {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      pollingStartRef.current = null;
    }

    // Initial check
    checkEntities();
    pollingRef.current = setInterval(checkEntities, 3000);

    return () => {
      stopPolling();
    };
  }, [loaded, worldId, userId, state.currentStep, state.completedSteps, state.finished, completeStep]);

  // ── Cleanup polling on unmount ──
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  return {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    isFinished: state.finished,
    isDismissed: state.dismissed,
    completeStep,
    dismiss,
    resume,
  };
}
