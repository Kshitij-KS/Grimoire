"use client";

import { useEffect } from "react";

/**
 * Registers keyboard shortcuts for immersive writing mode.
 *
 * - Escape → exits immersive mode (stops propagation to prevent
 *   browser-native fullscreen exit from firing independently)
 * - Ctrl/Cmd+S → triggers save (prevents browser save-page dialog);
 *   duplicate requests are ignored while a save is in progress
 * - Ctrl/Cmd+Shift+F → exits immersive mode (prevents default)
 *
 * Listeners are only active when `isImmersive` is true.
 */
export function useImmersiveKeyboard(props: {
  isImmersive: boolean;
  onExit: () => void;
  onSave: () => void;
  isSaving: boolean;
}): void {
  const { isImmersive, onExit, onSave, isSaving } = props;

  useEffect(() => {
    if (!isImmersive) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onExit();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isSaving) onSave();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        onExit();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isImmersive, onExit, onSave, isSaving]);
}
