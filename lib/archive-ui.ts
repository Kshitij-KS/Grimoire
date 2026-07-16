// Shared UI timing + layout constants for the Archive panels (Codex / Web /
// detail split / forge modal). These used to be magic numbers scattered across
// components, which is how coupled values (e.g. a modal's exit animation and
// the setTimeout that resets its state) silently drift out of sync. Keep them
// here so a single edit tunes every panel consistently.

/** Detail split / overlay slide animation, in seconds (framer-motion). */
export const PANEL_ANIM_S = 0.3;

/** Modal enter/exit animation, in seconds (framer-motion). */
export const MODAL_EXIT_S = 0.2;

/**
 * Modal exit, in milliseconds. Any post-close state reset MUST use this so it
 * fires exactly when the exit animation ends — never before (which would flash
 * stale content) and never long after.
 */
export const MODAL_EXIT_MS = Math.round(MODAL_EXIT_S * 1000);

/**
 * Debounce before committing an expensive relayout in response to a
 * ResizeObserver. The panel slide fires many resize events; we wait for it to
 * settle so the O(n²) force layout runs once, not per frame.
 */
export const RESIZE_SETTLE_MS = 120;

/**
 * Container width (px) below which Archive panels switch to their compact /
 * list layout. NOTE: mirrored by the `@container (min-width: 640px)` breakpoint
 * for `.codex-typebar` in `app/globals.css` — keep the two in step.
 */
export const ARCHIVE_NARROW_PX = 640;
