"use client";

import { useEffect } from "react";
import { type Editor } from "@tiptap/react";

/**
 * Typewriter scrolling for the immersive editor.
 *
 * When `enabled`, listens to the TipTap editor's `selectionUpdate` event and
 * scrolls the DOM node containing the cursor so its line sits at the vertical
 * center of the scroll viewport (`scrollIntoView({ block: "center" })`).
 *
 * When disabled or when `editor` is null, the hook is inert — no listener is
 * attached and scroll position is left untouched (Req 11.4).
 *
 * The listener is removed on unmount and re-subscribed whenever `editor` or
 * `enabled` changes, so there are no stale-closure or leaked-listener issues.
 */
export function useTypewriterScrolling(
  editor: Editor | null,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!editor || !enabled) return;

    // `selectionUpdate` fires on every cursor move — including every keystroke
    // while typing. Firing a fresh scroll on each one would stack competing
    // animations and make the viewport stutter/rubber-band. So we (a) coalesce
    // to at most one reposition per animation frame, and (b) scroll instantly
    // ("auto"), which keeps the caret pinned at center while text glides under
    // it — the whole point of typewriter mode. Smooth scrolling here fights
    // itself and reads as jank.
    let rafId: number | null = null;

    const reposition = () => {
      rafId = null;
      // Resolve the DOM node at the cursor head. domAtPos may return a text
      // node, which has no scrollIntoView — fall back to its parent element.
      const { node } = editor.view.domAtPos(editor.state.selection.head);
      const el = node instanceof HTMLElement ? node : node.parentElement;
      el?.scrollIntoView({ block: "center", behavior: "auto" });
    };

    const onSelectionUpdate = () => {
      // Collapse bursts of selection changes within a frame into one scroll.
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(reposition);
    };

    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [editor, enabled]);
}
