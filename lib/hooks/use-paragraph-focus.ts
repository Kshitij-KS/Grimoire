"use client";

import { useEffect, useRef } from "react";
import { type Editor } from "@tiptap/react";
import { useFocusModeStore } from "@/lib/stores/focus-mode-store";

/**
 * Applies paragraph focus mode to the immersive editor.
 *
 * When enabled, all top-level block nodes (direct children of `.ProseMirror`)
 * are dimmed to opacity 0.3 except the one containing the cursor (opacity 1.0).
 * Opacity transitions over 400ms using an ease-out cubic-bezier curve.
 *
 * Behavior:
 * - Respects `prefers-reduced-motion: reduce` — applies changes instantly
 *   without CSS transitions.
 * - When disabled, restores all nodes to opacity 1.0 with a 200ms transition.
 * - Skips dimming entirely if the document has fewer than 2 top-level block nodes.
 * - Cleans up (restores opacity, removes event listeners) on unmount.
 */
export function useParagraphFocus(editor: Editor | null): void {
  const showParagraphFocus = useFocusModeStore(
    (state) => state.showParagraphFocus
  );
  const reducedMotionRef = useRef(false);
  const previousActiveIndexRef = useRef<number | null>(null);

  // Detect prefers-reduced-motion on mount and listen for changes
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mql.matches;

    const onChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!editor) return;

    const ACTIVE_OPACITY = "1";
    const DIMMED_OPACITY = "0.3";
    const TRANSITION_ENABLE =
      "opacity 400ms cubic-bezier(0.22, 1, 0.36, 1)";
    const TRANSITION_DISABLE = "opacity 200ms cubic-bezier(0.22, 1, 0.36, 1)";

    /**
     * Returns the direct children elements of the .ProseMirror container.
     */
    function getBlockNodes(): HTMLElement[] {
      const proseMirror = editor!.view.dom;
      if (!proseMirror) return [];
      return Array.from(proseMirror.children) as HTMLElement[];
    }

    /**
     * Finds the index of the top-level block node containing the current cursor.
     */
    function getActiveBlockIndex(): number | null {
      if (!editor!.state.selection) return null;

      const { $anchor } = editor!.state.selection;
      // Walk to depth 1 to find the top-level block node
      if ($anchor.depth < 1) return null;

      const resolvedPos = $anchor.node(1);
      // Find which top-level child matches
      const doc = editor!.state.doc;
      let index = 0;
      let found = false;
      doc.forEach((node, _offset, i) => {
        if (node === resolvedPos) {
          index = i;
          found = true;
        }
      });

      if (!found) {
        // Fallback: use the position to determine the index
        const pos = $anchor.before(1);
        let currentPos = 0;
        let idx = 0;
        doc.forEach((node) => {
          if (currentPos === pos) {
            index = idx;
            found = true;
          }
          currentPos += node.nodeSize;
          idx++;
        });
      }

      return found ? index : null;
    }

    /**
     * Applies opacity styling to all block nodes based on which is active.
     */
    function applyFocus() {
      const nodes = getBlockNodes();

      // Skip dimming if fewer than 2 top-level block nodes (Req 6.5)
      if (nodes.length < 2) {
        // Ensure all nodes are fully visible
        nodes.forEach((node) => {
          node.style.opacity = "";
          node.style.transition = "";
        });
        previousActiveIndexRef.current = null;
        return;
      }

      const activeIndex = getActiveBlockIndex();
      previousActiveIndexRef.current = activeIndex;

      const useTransition = !reducedMotionRef.current;

      nodes.forEach((node, i) => {
        node.style.transition = useTransition ? TRANSITION_ENABLE : "";
        node.style.opacity = i === activeIndex ? ACTIVE_OPACITY : DIMMED_OPACITY;
      });
    }

    /**
     * Restores all nodes to full opacity with an optional transition.
     */
    function restoreAll() {
      const nodes = getBlockNodes();
      const useTransition = !reducedMotionRef.current;

      nodes.forEach((node) => {
        node.style.transition = useTransition ? TRANSITION_DISABLE : "";
        node.style.opacity = ACTIVE_OPACITY;
      });

      previousActiveIndexRef.current = null;
    }

    if (!showParagraphFocus) {
      // Restore all and clean up
      restoreAll();
      return;
    }

    // Initial application
    applyFocus();

    // Listen to editor selection changes
    const onSelectionUpdate = () => {
      applyFocus();
    };

    editor.on("selectionUpdate", onSelectionUpdate);

    // Clean up: restore opacity and remove listener
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
      restoreAll();
    };
  }, [editor, showParagraphFocus]);
}
