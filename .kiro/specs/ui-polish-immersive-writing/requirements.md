# Requirements Document

## Introduction

This document defines the formal requirements for three UI improvements to the Grimoire worldbuilding studio: an immersive full-screen writing mode for the lore editor, minimal dashboard visual polish, and a tabbed settings page redesign. The immersive writing mode is the central feature, providing a distraction-free, atmospheric environment for creative writing within the existing LoomEditor.

## Glossary

- **ImmersivePortal**: A React portal component that renders the full-screen writing canvas detached from the normal DOM hierarchy
- **ImmersiveToolbar**: A minimal, auto-hiding toolbar displayed at the bottom of the immersive canvas providing formatting controls and status
- **AmbientLayer**: A decorative CSS-only layer rendering atmospheric visual effects (vignette, gradients, grain) behind the writing canvas
- **FocusModeStore**: A Zustand state slice managing immersive mode state and user preferences, persisted to localStorage
- **LoomEditor**: The existing TipTap-based rich text editor used for lore entries
- **SettingsLayout**: The redesigned settings page component using tab-based navigation driven by URL search params
- **Paragraph_Focus**: A mode that highlights the active paragraph and dims all others to reduce visual distraction
- **Typewriter_Scrolling**: A mode that keeps the active editing line centered vertically in the viewport
- **Fullscreen_API**: The native browser API (`document.requestFullscreen`) for entering true fullscreen mode
- **CSS_Fullscreen**: A fallback positioning strategy using `position: fixed; inset: 0; z-index: 9999` when the Fullscreen API is unavailable

## Requirements

### Requirement 1: Immersive Mode Entry

**User Story:** As a writer, I want to enter a distraction-free full-screen writing mode, so that I can focus entirely on my creative work without UI chrome.

#### Acceptance Criteria

1. WHEN the user clicks the "Focus" button in the LoomEditor toolbar, THE ImmersivePortal SHALL render a full-screen writing canvas
2. WHEN the user presses Ctrl+Shift+F (or Cmd+Shift+F on macOS) while the LoomEditor has focus, THE ImmersivePortal SHALL render a full-screen writing canvas
3. WHEN immersive mode is activated, THE FocusModeStore SHALL set the `isImmersive` state to `true`
4. WHEN immersive mode is activated, THE ImmersivePortal SHALL request native fullscreen via the Fullscreen API
5. WHEN entering immersive mode, THE ImmersivePortal SHALL animate the entrance with a fade-in and scale transition lasting 400ms
6. IF the user has `prefers-reduced-motion: reduce` enabled, THEN THE ImmersivePortal SHALL skip the entrance animation and render the canvas immediately without fade or scale transitions
7. IF the LoomEditor is in readonly mode, THEN THE ImmersivePortal SHALL NOT activate immersive mode when the user clicks the "Focus" button or presses the keyboard shortcut

### Requirement 2: Immersive Mode Exit

**User Story:** As a writer, I want to exit immersive mode easily, so that I can return to the full editor without losing my work.

#### Acceptance Criteria

1. WHEN the user presses Escape while in immersive mode, THE ImmersivePortal SHALL exit immersive mode and transfer focus to the normal LoomEditor
2. WHEN the user presses Ctrl+Shift+F while in immersive mode, THE ImmersivePortal SHALL exit immersive mode
3. WHEN the user clicks the exit button in the ImmersiveToolbar, THE ImmersivePortal SHALL exit immersive mode
4. WHEN exiting immersive mode, THE ImmersivePortal SHALL animate the exit with a fade-out transition lasting 250ms and SHALL remove the portal from the DOM only after the animation completes
5. WHEN exiting immersive mode, THE ImmersivePortal SHALL exit native fullscreen via the Fullscreen API
6. WHEN exiting immersive mode, THE LoomEditor SHALL contain the same content as the immersive editor at the time of exit, including any edits made during the immersive session
7. WHEN exiting immersive mode, THE FocusModeStore SHALL set the `isImmersive` state to `false`
8. IF an exit action is triggered while a save operation is in progress, THEN THE ImmersivePortal SHALL allow the save operation to complete without interruption before removing the portal

### Requirement 3: Content Preservation During Mode Transitions

**User Story:** As a writer, I want my work preserved during mode transitions, so that I never lose content when switching between normal and immersive editing.

#### Acceptance Criteria

1. WHEN entering immersive mode, THE ImmersivePortal SHALL preserve the editor cursor position and selection range such that the immersive canvas displays the cursor at the same document offset and any active selection remains highlighted
2. WHEN exiting immersive mode, THE LoomEditor SHALL restore the editor cursor position and selection range to match the state held by the immersive editor at the time of exit
3. WHEN exiting immersive mode, THE LoomEditor SHALL contain the same content as the immersive editor at the time of exit, verified by structural equality of the editor document model
4. IF a save failure occurs during immersive mode, THEN THE ImmersivePortal SHALL display a toast notification for 5 seconds indicating the failure reason, without exiting immersive mode and without discarding any unsaved content
5. IF a save failure occurs during immersive mode and the user subsequently exits immersive mode, THEN THE LoomEditor SHALL retain all content from the immersive editor including any unsaved changes

### Requirement 4: Immersive Toolbar Behavior

**User Story:** As a writer, I want the toolbar to stay out of my way while still being accessible, so that I can format text when needed without constant distraction.

#### Acceptance Criteria

1. WHEN the user moves the mouse or presses a key while in immersive mode, THE ImmersiveToolbar SHALL become visible with a slide-up and fade-in animation lasting 300ms
2. WHEN 3 seconds elapse without mouse movement or key press, THE ImmersiveToolbar SHALL hide itself with a fade-out animation lasting 200ms
3. WHILE the ImmersiveToolbar is visible and the user moves the mouse over the toolbar or interacts with a toolbar control, THE ImmersiveToolbar SHALL reset the 3-second inactivity timer
4. WHILE the ImmersiveToolbar is visible, THE ImmersiveToolbar SHALL display formatting controls for bold, italic, heading, and quote
5. WHILE the ImmersiveToolbar is visible, THE ImmersiveToolbar SHALL display the current word count as an integer representing the number of whitespace-delimited tokens in the editor content
6. WHILE the ImmersiveToolbar is visible, THE ImmersiveToolbar SHALL display a save status indicator with two states: "Saved" when no unsaved changes exist, and "Unsaved" when content has been modified since the last successful save
7. WHEN the user presses Ctrl+S (or Cmd+S on macOS) while in immersive mode, THE ImmersivePortal SHALL trigger a save operation

### Requirement 5: Ambient Atmosphere Effects

**User Story:** As a writer, I want subtle atmospheric visual effects, so that the writing environment feels immersive and creatively inspiring.

#### Acceptance Criteria

1. WHEN immersive mode is active, THE AmbientLayer SHALL render a vignette darkening effect using a radial gradient that transitions from transparent at the center to a darkened edge color at the viewport perimeter
2. WHEN immersive mode is active, THE AmbientLayer SHALL render gradient color shifts using CSS-only animations with a cycle duration of no less than 20 seconds, at a maximum color-mix intensity of 5% of the accent color
3. WHEN immersive mode is active, THE AmbientLayer SHALL render a grain texture overlay at an opacity no greater than 0.03
4. THE AmbientLayer SHALL use only CSS animations with no JavaScript requestAnimationFrame loops
5. IF the user has `prefers-reduced-motion: reduce` enabled, THEN THE AmbientLayer SHALL disable all CSS animations and render effects as static layers only
6. THE AmbientLayer SHALL set `pointer-events: none` on all effect layers so that no atmospheric element captures user interaction
7. WHEN the FocusModeStore `ambientIntensity` preference is set, THE AmbientLayer SHALL scale effect opacity according to the selected level: "subtle" renders at base opacity, "medium" renders at 1.5x base opacity, and "vivid" renders at 2.5x base opacity

### Requirement 6: Paragraph Focus Mode

**User Story:** As a writer, I want to focus on the paragraph I am currently editing, so that I can concentrate on one thought at a time without visual distraction from surrounding text.

#### Acceptance Criteria

1. WHEN paragraph focus is enabled, THE LoomEditor SHALL dim all top-level block nodes (paragraphs, headings, blockquotes, list items) except the one containing the cursor to an opacity of 0.3, and display the active block node at an opacity of 1.0
2. WHEN the cursor moves to a different block node while paragraph focus is enabled, THE LoomEditor SHALL transition the opacity change over 400ms using an ease-out timing function
3. IF the user has `prefers-reduced-motion: reduce` enabled, THEN THE LoomEditor SHALL apply paragraph dimming changes instantly without transition animations
4. WHEN paragraph focus is disabled, THE LoomEditor SHALL restore all block nodes to an opacity of 1.0 within 200ms
5. IF the document contains fewer than 2 top-level block nodes while paragraph focus is enabled, THEN THE LoomEditor SHALL display all content at full opacity without applying dimming

### Requirement 7: Fullscreen API Graceful Degradation

**User Story:** As a writer using a browser that restricts the Fullscreen API, I want immersive mode to still work, so that I can use the feature regardless of browser limitations.

#### Acceptance Criteria

1. IF the Fullscreen API is unavailable or `requestFullscreen()` is rejected, THEN THE ImmersivePortal SHALL fall back to CSS-based fullscreen using fixed positioning with `inset: 0` and `z-index: 9999`
2. IF the Fullscreen API is unavailable or `requestFullscreen()` is rejected, THEN THE ImmersivePortal SHALL log a warning to the console without displaying an error to the user
3. WHILE in CSS fallback fullscreen mode, THE ImmersivePortal SHALL render the AmbientLayer, ImmersiveToolbar, paragraph focus, and keyboard shortcuts identically to native fullscreen mode
4. WHILE in CSS fallback fullscreen mode, WHEN the user presses Escape, Ctrl+Shift+F, or clicks the exit button, THE ImmersivePortal SHALL exit immersive mode using the same mechanisms as native fullscreen mode

### Requirement 8: Focus Mode Preferences Persistence

**User Story:** As a writer, I want my immersive mode preferences remembered between sessions, so that I do not have to reconfigure the environment each time.

#### Acceptance Criteria

1. WHEN the user changes a focus mode preference (ambient intensity, paragraph focus, typewriter scrolling, toolbar auto-hide, soundscape), THE FocusModeStore SHALL persist the updated preference to localStorage within the same event loop cycle
2. WHEN the application loads, THE FocusModeStore SHALL restore previously persisted preferences from localStorage and apply them to the active state
3. IF localStorage is unavailable or quota is exceeded, THEN THE FocusModeStore SHALL use in-memory defaults (ambientIntensity: "subtle", showParagraphFocus: false, typewriterScrolling: false, toolbarAutoHide: true, soundscape: "none") and operate without persistence
4. IF `ambientIntensity` retrieved from localStorage is not one of "subtle", "medium", or "vivid", THEN THE FocusModeStore SHALL discard the invalid value and apply the default value of "subtle"
5. IF `soundscape` retrieved from localStorage is not one of "none", "rain", "fireplace", or "quill", THEN THE FocusModeStore SHALL discard the invalid value and apply the default value of "none"
6. IF persisted data in localStorage is unparseable or contains non-boolean values for `showParagraphFocus`, `typewriterScrolling`, or `toolbarAutoHide`, THEN THE FocusModeStore SHALL discard the corrupted data and apply in-memory defaults for all preferences

### Requirement 9: Immersive Mode Keyboard Shortcuts

**User Story:** As a writer, I want keyboard shortcuts to work correctly within immersive mode, so that I can control the environment without reaching for the mouse.

#### Acceptance Criteria

1. WHILE immersive mode is active, WHEN the user presses Escape, THE ImmersivePortal SHALL exit immersive mode and stop event propagation so that the keydown event does not reach parent handlers or trigger browser-native fullscreen exit independently
2. WHILE immersive mode is active, WHEN the user presses Ctrl+S (or Cmd+S on macOS), THE ImmersivePortal SHALL trigger a save operation and prevent the browser default save-page dialog
3. WHILE immersive mode is active, WHEN the user presses Ctrl+Shift+F (or Cmd+Shift+F on macOS), THE ImmersivePortal SHALL exit immersive mode and prevent the browser default action for that key combination
4. WHILE immersive mode is inactive, WHEN the user presses Ctrl+Shift+F (or Cmd+Shift+F on macOS) while the LoomEditor has focus, THE ImmersivePortal SHALL enter immersive mode
5. IF a save operation is already in progress, THEN WHEN the user presses Ctrl+S (or Cmd+S on macOS) in immersive mode, THE ImmersivePortal SHALL ignore the duplicate save request and not initiate another save operation until the current one completes or fails

### Requirement 10: Dashboard Stat Cards Polish

**User Story:** As a user viewing the dashboard, I want stat cards to feel visually balanced, so that the numbers are readable without feeling cramped.

#### Acceptance Criteria

1. THE Dashboard SHALL render stat card numbers using `text-4xl` font size instead of `text-5xl`
2. IF a world has no premise text (premise is null, undefined, or empty string), THEN THE Dashboard SHALL render that world card header at reduced height (`h-20`)
3. IF a world has premise text (premise is a non-empty string), THEN THE Dashboard SHALL render that world card header at standard height (`h-28`)

### Requirement 11: Dashboard Activity Feed Polish

**User Story:** As a user viewing the dashboard, I want the activity feed to feel compact and clean, so that I can scan recent activity without visual clutter.

#### Acceptance Criteria

1. THE Dashboard SHALL render activity feed date group headers using static positioning without sticky behavior, without `z-index` elevation, and without backdrop-blur background treatment
2. THE Dashboard SHALL render the Quick Actions card without the `arcane-border` decorative pseudo-element while retaining the `glass-panel` base styling

### Requirement 12: Settings Page Tabbed Navigation

**User Story:** As a user managing my account, I want settings organized into clear tabs, so that I can find and change specific settings without scrolling through unrelated options.

#### Acceptance Criteria

1. WHEN the user navigates to the settings page, THE SettingsLayout SHALL display tabs for Account, Preferences, Usage, Billing, and Danger Zone
2. WHEN the user navigates to the settings page without a `?tab=` URL parameter, THE SettingsLayout SHALL default to the Account tab and set the URL parameter to `?tab=account`
3. WHEN the user clicks a settings tab, THE SettingsLayout SHALL push a new history entry with the `?tab=` parameter set to the corresponding tab identifier (one of "account", "preferences", "usage", "billing", "danger-zone")
4. WHEN the URL `?tab=` parameter changes (including browser back/forward navigation), THE SettingsLayout SHALL render the corresponding tab content without a full page reload
5. IF the URL `?tab=` parameter contains a value that does not match any defined tab identifier, THEN THE SettingsLayout SHALL fall back to the Account tab and update the URL parameter to `?tab=account`
6. WHEN switching between tabs, THE SettingsLayout SHALL animate the content transition using AnimatePresence with a wait mode and a crossfade duration of no more than 200ms
7. WHEN viewed on desktop (viewport width >= 1024px), THE SettingsLayout SHALL display a vertical tab navigation sidebar
8. WHEN viewed on mobile (viewport width < 1024px), THE SettingsLayout SHALL display a horizontal scrollable tab strip

### Requirement 13: Writing Preferences in Settings

**User Story:** As a writer, I want to configure my immersive mode defaults from the settings page, so that I can set up my preferred writing environment once.

#### Acceptance Criteria

1. WHEN the Preferences tab is active, THE SettingsLayout SHALL display a "Writing preferences" section with controls for ambient intensity, typewriter scrolling, paragraph focus, and toolbar auto-hide, each reflecting the current value from the FocusModeStore
2. WHEN the user changes a writing preference in settings, THE FocusModeStore SHALL update the corresponding preference value within 100ms of the user interaction
3. THE SettingsLayout SHALL render ambient intensity as a select control with options "Subtle", "Medium", and "Vivid", with the current FocusModeStore `ambientIntensity` value pre-selected
4. THE SettingsLayout SHALL render typewriter scrolling, paragraph focus, and toolbar auto-hide as toggle controls displaying their on/off state corresponding to the FocusModeStore boolean values
5. IF the FocusModeStore contains an invalid `ambientIntensity` value, THEN THE SettingsLayout SHALL display the select control with "Subtle" selected as the default

### Requirement 14: Immersive Canvas Layout

**User Story:** As a writer, I want the immersive writing area to have comfortable proportions, so that my text feels easy to read and write without strain.

#### Acceptance Criteria

1. WHILE in immersive mode, THE ImmersivePortal SHALL render the writing column at 100% width with a maximum width of 680px, horizontally centered within the viewport, with horizontal padding of 2rem
2. WHILE in immersive mode, THE ImmersivePortal SHALL apply top padding of 12vh and bottom padding of 30vh to the writing column
3. WHILE in immersive mode, THE ImmersivePortal SHALL hide scrollbar UI elements while maintaining vertical scroll functionality on the writing column
4. WHILE in immersive mode, THE ImmersivePortal SHALL render the writing canvas with a fixed-position container filling the entire viewport at z-index 9999
