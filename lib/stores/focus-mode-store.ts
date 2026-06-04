"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ── Types ──

type AmbientIntensity = "subtle" | "medium" | "vivid";
type Soundscape = "none" | "rain" | "fireplace" | "quill";

export interface FocusModeState {
  isImmersive: boolean;
  ambientIntensity: AmbientIntensity;
  showParagraphFocus: boolean;
  typewriterScrolling: boolean;
  toolbarAutoHide: boolean;
  soundscape: Soundscape;

  setImmersive: (value: boolean) => void;
  setAmbientIntensity: (value: AmbientIntensity) => void;
  toggleParagraphFocus: () => void;
  toggleTypewriterScrolling: () => void;
  toggleToolbarAutoHide: () => void;
  setSoundscape: (value: Soundscape) => void;
}

// ── Defaults ──

const VALID_AMBIENT_INTENSITIES: AmbientIntensity[] = [
  "subtle",
  "medium",
  "vivid",
];
const VALID_SOUNDSCAPES: Soundscape[] = [
  "none",
  "rain",
  "fireplace",
  "quill",
];

export const FOCUS_MODE_DEFAULTS = {
  isImmersive: false,
  ambientIntensity: "subtle" as AmbientIntensity,
  showParagraphFocus: false,
  typewriterScrolling: false,
  toolbarAutoHide: true,
  soundscape: "none" as Soundscape,
};

// ── Validation helpers ──

function isValidAmbientIntensity(value: unknown): value is AmbientIntensity {
  return (
    typeof value === "string" &&
    VALID_AMBIENT_INTENSITIES.includes(value as AmbientIntensity)
  );
}

function isValidSoundscape(value: unknown): value is Soundscape {
  return (
    typeof value === "string" &&
    VALID_SOUNDSCAPES.includes(value as Soundscape)
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Validates hydrated state from localStorage and returns sanitized values.
 * Any invalid field causes all preferences to fall back to defaults (per Req 8.6).
 */
export function validatePersistedState(
  persisted: Record<string, unknown>,
): Partial<FocusModeState> {
  // Validate enum fields individually (Req 8.4, 8.5)
  const ambientIntensity = isValidAmbientIntensity(persisted.ambientIntensity)
    ? persisted.ambientIntensity
    : FOCUS_MODE_DEFAULTS.ambientIntensity;

  const soundscape = isValidSoundscape(persisted.soundscape)
    ? persisted.soundscape
    : FOCUS_MODE_DEFAULTS.soundscape;

  // Validate booleans — if any is non-boolean, discard ALL and use defaults (Req 8.6)
  const booleanFields = [
    "showParagraphFocus",
    "typewriterScrolling",
    "toolbarAutoHide",
  ] as const;

  for (const field of booleanFields) {
    if (field in persisted && !isBoolean(persisted[field])) {
      // Corrupted data — return full defaults
      return { ...FOCUS_MODE_DEFAULTS };
    }
  }

  return {
    isImmersive: isBoolean(persisted.isImmersive)
      ? persisted.isImmersive
      : FOCUS_MODE_DEFAULTS.isImmersive,
    ambientIntensity,
    showParagraphFocus: isBoolean(persisted.showParagraphFocus)
      ? persisted.showParagraphFocus
      : FOCUS_MODE_DEFAULTS.showParagraphFocus,
    typewriterScrolling: isBoolean(persisted.typewriterScrolling)
      ? persisted.typewriterScrolling
      : FOCUS_MODE_DEFAULTS.typewriterScrolling,
    toolbarAutoHide: isBoolean(persisted.toolbarAutoHide)
      ? persisted.toolbarAutoHide
      : FOCUS_MODE_DEFAULTS.toolbarAutoHide,
    soundscape,
  };
}

// ── Storage wrapper with QuotaExceededError handling ──

function getSafeStorage() {
  return {
    getItem(name: string): string | null {
      try {
        return localStorage.getItem(name);
      } catch {
        // localStorage unavailable — return null so defaults are used
        return null;
      }
    },
    setItem(name: string, value: string): void {
      try {
        localStorage.setItem(name, value);
      } catch (error: unknown) {
        // QuotaExceededError or SecurityError — operate without persistence (Req 8.3)
        if (
          error instanceof DOMException &&
          (error.name === "QuotaExceededError" ||
            error.name === "SecurityError")
        ) {
          return;
        }
        // Re-throw unexpected errors
        throw error;
      }
    },
    removeItem(name: string): void {
      try {
        localStorage.removeItem(name);
      } catch {
        // Silently ignore if localStorage is unavailable
      }
    },
  };
}

// ── Store ──

export const useFocusModeStore = create<FocusModeState>()(
  persist(
    (set) => ({
      ...FOCUS_MODE_DEFAULTS,

      setImmersive: (value) => set({ isImmersive: value }),
      setAmbientIntensity: (value) => set({ ambientIntensity: value }),
      toggleParagraphFocus: () =>
        set((state) => ({ showParagraphFocus: !state.showParagraphFocus })),
      toggleTypewriterScrolling: () =>
        set((state) => ({ typewriterScrolling: !state.typewriterScrolling })),
      toggleToolbarAutoHide: () =>
        set((state) => ({ toolbarAutoHide: !state.toolbarAutoHide })),
      setSoundscape: (value) => set({ soundscape: value }),
    }),
    {
      name: "grimoire-focus-mode",
      storage: createJSONStorage(() => getSafeStorage()),
      merge: (persistedState, currentState) => {
        if (
          !persistedState ||
          typeof persistedState !== "object" ||
          Array.isArray(persistedState)
        ) {
          // Unparseable or missing — use defaults (Req 8.6)
          return currentState;
        }

        const validated = validatePersistedState(
          persistedState as Record<string, unknown>,
        );
        return { ...currentState, ...validated };
      },
    },
  ),
);
