// Single home for UI timing + layout constants (Archive panels, the workspace
// section transition, modals). These used to be magic numbers scattered across
// components, which is how coupled values (e.g. a modal's exit animation and
// the setTimeout that resets its state) silently drift out of sync. Keep them
// here so a single edit tunes everything consistently.

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

// ── Workspace section transition ───────────────────────────────────────────
// How long the section-change loading sigil is held. Heavy sections genuinely
// take longer to mount, so the animation covers that work; light sections stay
// snappy so navigation never feels artificially slow.
export const SECTION_TRANSITION_HEAVY_MS = 650;
export const SECTION_TRANSITION_LIGHT_MS = 320;

/** Sections whose views are expensive to mount (canvas / graph / large grids). */
export const HEAVY_SECTIONS: ReadonlySet<string> = new Set(["bible", "tavern", "souls"]);

/** Loading-sigil hold duration (ms) for a given section. */
export function sectionTransitionMs(section: string): number {
  return HEAVY_SECTIONS.has(section)
    ? SECTION_TRANSITION_HEAVY_MS
    : SECTION_TRANSITION_LIGHT_MS;
}
