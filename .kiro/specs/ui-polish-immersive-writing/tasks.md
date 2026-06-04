# Implementation Plan: UI Polish & Immersive Writing Experience

## Overview

This plan implements the three interconnected UI improvements in dependency order: shared state infrastructure first, then dashboard polish (quick wins), then settings redesign, then the immersive writing mode (the most complex feature). Each step builds incrementally so there is no orphaned code.

## Tasks

- [ ] 1. Create FocusModeStore and shared infrastructure
  - [ ] 1.1 Create the FocusModeStore Zustand slice with localStorage persistence
    - Create `lib/stores/focus-mode-store.ts`
    - Implement the `FocusModeState` interface with all preference fields: `isImmersive`, `ambientIntensity`, `showParagraphFocus`, `typewriterScrolling`, `toolbarAutoHide`, `soundscape`
    - Add validation logic for enum fields on hydration (reject invalid values, fall back to defaults)
    - Handle `QuotaExceededError` gracefully — use in-memory defaults when localStorage is unavailable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 1.2 Write property tests for FocusModeStore persistence and validation
    - **Property 5: Focus mode preferences persistence round-trip**
    - **Property 6: Focus mode preference validation**
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5**

  - [ ] 1.3 Create the `useFullscreen` hook with graceful degradation
    - Create `hooks/use-fullscreen.ts`
    - Implement `enter()` calling `document.documentElement.requestFullscreen()` with try/catch
    - Implement `exit()` calling `document.exitFullscreen()`
    - Track `isFullscreen` state via `fullscreenchange` event listener
    - Fall back to CSS-only fullscreen (set a `isCssFallback` flag) when API is unavailable or rejected
    - Log warning to console on fallback — no user-facing error
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 1.4 Create the `useToolbarVisibility` hook
    - Create `hooks/use-toolbar-visibility.ts`
    - Implement show/hide logic with configurable timeout (default 3000ms)
    - Listen to `mousemove` and `keydown` events (passive)
    - Reset timer on toolbar interaction
    - Clean up event listeners on unmount
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 1.5 Write property test for toolbar visibility timeout behavior
    - **Property 3: Toolbar visibility timeout behavior**
    - **Validates: Requirements 4.1, 4.2**

- [ ] 2. Dashboard polish — minimal CSS fixes
  - [ ] 2.1 Fix stat cards, world cards, activity feed, and quick actions
    - In `components/dashboard/dashboard-overview.tsx` (or relevant sub-components):
    - Change stat card number from `text-5xl` to `text-4xl`
    - Make world card header height conditional: `h-28` when premise exists, `h-20` when no premise
    - Remove `sticky top-0 z-10` and `backdrop-blur` from activity feed date group headers
    - Remove `arcane-border` class from Quick Actions card while keeping `glass-panel`
    - _Requirements: 10.1, 10.2, 10.3, 11.1, 11.2_

- [ ] 3. Settings page redesign — tabbed navigation
  - [ ] 3.1 Create the SettingsLayout component with tab navigation
    - Create `components/settings/settings-layout.tsx` (client component)
    - Define `SETTINGS_TABS` config array with id, label, icon, description
    - Read active tab from URL `?tab=` search param (default to "account")
    - Push new history entry on tab click via `router.push`
    - Validate URL param — fall back to "account" for unknown values
    - Render vertical sidebar nav on desktop (lg:), horizontal scrollable strip on mobile
    - Wrap tab content in `AnimatePresence mode="wait"` with crossfade ≤200ms
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [ ] 3.2 Create the PreferencesTab with Writing Preferences section
    - Create `components/settings/preferences-tab.tsx`
    - Render "Writing preferences" section with controls bound to FocusModeStore
    - Ambient intensity as select control (Subtle / Medium / Vivid)
    - Typewriter scrolling, paragraph focus, toolbar auto-hide as toggle controls
    - Changes update FocusModeStore immediately (within 100ms)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 3.3 Refactor settings page to use SettingsLayout
    - Update `app/dashboard/settings/page.tsx` to use the new SettingsLayout
    - Move existing settings content into appropriate tab components (AccountTab, UsageTab, BillingTab, DangerTab)
    - Ensure server-side session validation is preserved
    - _Requirements: 12.1, 12.2_

  - [ ]* 3.4 Write property test for settings tab-URL bidirectional sync
    - **Property 8: Settings tab-URL bidirectional sync**
    - **Validates: Requirements 12.3, 12.4**

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Immersive writing mode — core components
  - [ ] 5.1 Create the AmbientLayer component
    - Create `components/lore/ambient-layer.tsx`
    - Render vignette using radial gradient (transparent center → darkened edges)
    - Render ambient gradient color shifts with CSS animation (≥20s cycle, ≤5% accent color intensity)
    - Render grain texture overlay at opacity ≤0.03
    - All effects use CSS-only animations (no requestAnimationFrame)
    - Set `pointer-events: none` on all layers
    - Respect `prefers-reduced-motion: reduce` — disable animations, render static layers
    - Scale opacity based on `intensity` prop: subtle=base, medium=1.5x, vivid=2.5x
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 5.2 Create the ImmersiveToolbar component
    - Create `components/lore/immersive-toolbar.tsx`
    - Render formatting controls: bold, italic, heading, quote (use TipTap editor commands)
    - Display word count (whitespace-delimited token count)
    - Display save status indicator ("Saved" / "Unsaved")
    - Provide exit button
    - Use `useToolbarVisibility` hook for auto-hide behavior
    - Animate show/hide with slide-up (300ms) and fade-out (200ms)
    - Reset inactivity timer on toolbar hover/interaction
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 5.3 Create the `useImmersiveKeyboard` hook
    - Create `hooks/use-immersive-keyboard.ts`
    - Handle Escape → exit immersive mode, stop propagation
    - Handle Ctrl/Cmd+S → save, prevent default
    - Handle Ctrl/Cmd+Shift+F → exit immersive mode, prevent default
    - Ignore duplicate save requests while save is in progress
    - Only register listeners when `isImmersive` is true
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ]* 5.4 Write property test for keyboard event isolation
    - **Property 7: Immersive mode keyboard event isolation**
    - **Validates: Requirements 9.1**

- [ ] 6. Immersive writing mode — portal and integration
  - [ ] 6.1 Create the ImmersivePortal component
    - Create `components/lore/immersive-portal.tsx`
    - Render as a React portal to `document.body`
    - Compose AmbientLayer, ImmersiveToolbar, and writing column
    - Layout: fixed container filling viewport at z-index 9999
    - Writing column: 100% width, max-width 680px, centered, padding 12vh top / 30vh bottom
    - Hide scrollbar UI while maintaining scroll functionality
    - Animate entrance: fade-in + scale (400ms) with Framer Motion
    - Animate exit: fade-out (250ms), remove portal only after animation completes
    - Respect `prefers-reduced-motion` — skip entrance animation
    - Block activation if editor is in readonly mode
    - Use `useFullscreen` hook for native fullscreen with CSS fallback
    - Trigger save via Ctrl+S (delegate to `onSave` prop)
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 14.1, 14.2, 14.3, 14.4_

  - [ ] 6.2 Implement paragraph focus mode in the immersive editor
    - Create `hooks/use-paragraph-focus.ts` or integrate into ImmersivePortal
    - Dim all top-level block nodes to opacity 0.3 except the active one (opacity 1.0)
    - Transition opacity over 400ms with ease-out timing
    - Respect `prefers-reduced-motion` — apply changes instantly without transition
    - Restore all nodes to opacity 1.0 within 200ms when disabled
    - Skip dimming if document has fewer than 2 top-level block nodes
    - Read `showParagraphFocus` from FocusModeStore
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.3 Write property test for paragraph focus dimming invariant
    - **Property 4: Paragraph focus dimming invariant**
    - **Validates: Requirements 6.1**

  - [ ] 6.4 Integrate ImmersivePortal into LoomEditor
    - Modify `components/lore/loom-editor.tsx`
    - Add "Focus" button to the LoomEditor toolbar
    - Wire Ctrl+Shift+F keyboard shortcut to toggle immersive mode (when editor has focus)
    - Conditionally render `<ImmersivePortal>` when `isImmersive` is true in FocusModeStore
    - Pass editor instance, title, word count, save handler, and processing state to portal
    - Preserve cursor position and selection range on entry and exit
    - Ensure content structural equality on exit (same TipTap document model)
    - Handle save failure: show toast notification for 5 seconds, retain all content
    - Allow in-progress save to complete before removing portal on exit
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 4.7, 9.4_

  - [ ]* 6.5 Write property tests for content and cursor round-trip
    - **Property 1: Immersive mode content round-trip**
    - **Property 2: Immersive mode cursor preservation round-trip**
    - **Validates: Requirements 2.6, 3.1, 3.2, 3.3**

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The dashboard polish (task 2) has no dependencies and can be done early for quick wins
- Settings redesign (task 3) depends on FocusModeStore (task 1.1) for the PreferencesTab
- Immersive mode (tasks 5–6) depends on all infrastructure from task 1

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["3.4", "5.4", "6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3", "6.4"] },
    { "id": 6, "tasks": ["6.5"] }
  ]
}
```
