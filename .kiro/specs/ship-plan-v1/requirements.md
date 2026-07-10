# Requirements Document

## Introduction

Grimoire is a Next.js 14 (App Router) + Supabase + Inngest + TypeScript application. A full-repo audit (SHIP_PLAN.md) identified a bounded set of loose ends blocking a shippable v1: silent bugs, cost/abuse holes, half-wired UI toggles, dead code, missing CI, and stale documentation. This specification captures the requirements for all four ship-plan phases:

- **Phase 0** — Unbreak the repo: line-ending normalization, root litter removal, package.json hygiene, and CI.
- **Phase 1** — Fix product-blocking bugs and cost/abuse holes, wire monitoring, and complete the two dead settings toggles.
- **Phase 2** — Repair user-visible dead-end UX, remove dead code, and fix theme-discipline violations.
- **Phase 3** — Rewrite documentation, add route-handler tests, and produce a launch checklist.

Four clarifying decisions override the plan defaults and are reflected in the requirements below:

1. **Upgrade CTAs (D2):** The five "Upgrade to Pro" CTAs point at a new waitlist email-capture destination (not a `BILLING_ENABLED` hide).
2. **Toggles (A3):** `typewriterScrolling` is implemented (scroll cursor line to vertical center on selection change), not deleted; `toolbarAutoHide` is wired into the immersive toolbar.
3. **Mobile nav (D1):** All seven sections are reachable via a "5 + More" bottom sheet, with the sheet pattern ported from `aether-dock.tsx` before that component is deleted.
4. **Entity merge tag remap (A1):** A `replace_entity_tag` Postgres RPC plus SQL migration is written (not the JS port); the dead duplicate route is deleted afterward, and a route-handler test asserts tags move.

## Glossary

- **Grimoire_App**: The complete Next.js application under audit.
- **Repository**: The Git-tracked source tree for Grimoire_App, including build config and CI.
- **CI_Pipeline**: The GitHub Actions workflow that runs on push and pull request.
- **Merge_Handler**: The API route handler at `app/api/entities/merge/route.ts` that merges two entities.
- **Replace_Entity_Tag_RPC**: The Postgres stored procedure `replace_entity_tag` that remaps `entity_tags` rows from a source entity to a target entity.
- **Import_Handler**: The API route handler at `app/api/worlds/[id]/import/route.ts` that imports lore entries.
- **Autocomplete_Handler**: The API route handler at `app/api/lore/autocomplete/route.ts`.
- **Demo_Chat_Handler**: The public API route handler at `app/api/demo/chat/route.ts`.
- **Eval_Webhook_Handler**: The API route handler at `app/api/eval/webhook/route.ts`.
- **Rate_Limiter**: The `checkAndIncrement` mechanism enforcing per-user daily usage limits (`DAILY_LIMITS`).
- **Access_Guard**: The `requireWorldAccess` authorization helper enforcing world-level roles (e.g., `editor`).
- **Sentry_Monitor**: The `@sentry/nextjs` integration, including `withErrorMonitoring` and instrumentation hooks.
- **Immersive_Toolbar**: The immersive writing toolbar in `components/lore/immersive-toolbar.tsx`.
- **Toolbar_Visibility**: The `useToolbarVisibility` hook in `lib/hooks/use-toolbar-visibility.ts`.
- **Immersive_Portal**: The immersive-mode entry animation in `components/lore/immersive-portal.tsx`.
- **Focus_Mode_Store**: The Zustand store `lib/stores/focus-mode-store.ts` holding editor preferences.
- **Editor**: The lore-editing surface that reads focus-mode preferences.
- **World_Sidebar**: The navigation component `components/layout/world-sidebar.tsx`.
- **Mobile_Nav**: The mobile navigation surface rendered by World_Sidebar.
- **More_Sheet**: The bottom-sheet overflow surface listing navigation sections beyond the first five.
- **Waitlist_Capture**: The waitlist email-capture destination that receives interested-user email addresses.
- **Upgrade_CTA**: Any of the five "Upgrade to Pro" call-to-action controls.
- **Echoes_Interface**: The soul-chat component `components/souls/echoes-interface.tsx`.
- **Account_Settings**: The account settings surface `components/settings/settings-content.tsx`.
- **Sitemap**: The generated sitemap at `app/sitemap.ts`.
- **Docs**: The developer documentation set, including `CLAUDE.md` and `README.md`.
- **Env_Example**: The root `.env.example` file documenting environment variables.
- **Dead_Component**: A component or module file with zero importers, listed for deletion in the audit.
- **Reviewer**: A developer or AI agent performing the launch checklist.

## Requirements

### Requirement 1: Phase 0 — Line-ending normalization

**User Story:** As a maintainer, I want consistent line endings tracked in Git, so that phantom CRLF/LF diffs stop burying real changes.

#### Acceptance Criteria

1. THE Repository SHALL contain a `.gitattributes` file that declares `* text=auto` and sets `eol=lf` for `.ts`, `.tsx`, `.css`, `.md`, `.json`, and `.sql` files.
2. WHEN the working tree is renormalized against the new `.gitattributes`, THE Repository SHALL produce a `git diff --ignore-all-space --stat` result that is empty.
3. THE Repository SHALL retain zero uncommitted line-ending-only changes after normalization is committed.

### Requirement 2: Phase 0 — Root litter removal

**User Story:** As a maintainer, I want one-off scratch files removed, so that the repository root reflects only shippable code.

#### Acceptance Criteria

1. THE Repository SHALL exclude the files `test-soul.mjs`, `scripts/test-gemini.mjs`, `tsc-output.txt`, and `models.json`.
2. THE Repository SHALL exclude the `scratch/` directory and its contents.
3. THE Repository SHALL declare `tsc-output.txt` and `.env*` patterns in `.gitignore`.

### Requirement 3: Phase 0 — package.json hygiene

**User Story:** As a maintainer, I want standard scripts and metadata in package.json, so that typechecking and Node version expectations are explicit.

#### Acceptance Criteria

1. THE Repository SHALL define a `typecheck` script in `package.json` with the value `tsc --noEmit`.
2. THE Repository SHALL define an `engines` field in `package.json` requiring Node version `>=20`.
3. THE Repository SHALL remove the `@google/generative-ai` dependency from `package.json`.
4. WHEN `npm install` resolves dependencies, THE Repository SHALL resolve the `lucide-react` version without error.

### Requirement 4: Phase 0 — Continuous integration

**User Story:** As a maintainer, I want automated checks on every push and pull request, so that lint, type, test, and build regressions are caught before merge.

#### Acceptance Criteria

1. THE Repository SHALL contain a GitHub Actions workflow at `.github/workflows/ci.yml`.
2. WHEN a push or pull request occurs, THE CI_Pipeline SHALL run dependency install, lint, `typecheck`, `vitest run`, and `next build` in sequence.
3. THE CI_Pipeline SHALL exclude the `eval:service` and `eval:setup` scripts from execution.
4. IF any of lint, `typecheck`, `vitest run`, or `next build` returns a non-zero exit code, THEN THE CI_Pipeline SHALL report a failed status.

### Requirement 5: Phase 1 — Entity merge tag remap (A1)

**User Story:** As a user merging entities, I want tags moved from the source entity to the target entity, so that no stale tags remain after a merge.

#### Acceptance Criteria

1. THE Repository SHALL contain a SQL migration that creates the Replace_Entity_Tag_RPC in the database.
2. WHEN the Merge_Handler processes a merge request, THE Merge_Handler SHALL invoke the Replace_Entity_Tag_RPC to remap `entity_tags` from the source entity to the target entity.
3. IF the Replace_Entity_Tag_RPC returns an error, THEN THE Merge_Handler SHALL return an error response rather than reporting success.
4. WHEN two entities with tags are merged, THE Replace_Entity_Tag_RPC SHALL result in all source-entity tags being associated with the target entity.
5. THE Repository SHALL remove the duplicate route file `app/api/entities/[id]/merge/route.ts` after the Replace_Entity_Tag_RPC is in place.
6. THE Repository SHALL contain a route-handler test that merges two tagged entities and asserts that the tags are associated with the target entity after the merge.

### Requirement 6: Phase 1 — World import metering and access (B1)

**User Story:** As the platform owner, I want world imports metered and access-controlled, so that imports cannot bypass free-tier caps or exclude collaborators.

#### Acceptance Criteria

1. WHEN the Import_Handler imports lore entries, THE Import_Handler SHALL count each imported entry against the `lore_ingest` limit via the Rate_Limiter.
2. IF an import would cause a world to exceed 50 lore entries on the free tier, THEN THE Import_Handler SHALL reject the import.
3. WHEN the Import_Handler authorizes a request, THE Import_Handler SHALL use the Access_Guard requiring the `editor` role rather than a raw `user_id` ownership check.
4. IF the Rate_Limiter reports the per-user `lore_ingest` limit is exceeded, THEN THE Import_Handler SHALL reject the import with a rate-limit response.

### Requirement 7: Phase 1 — Autocomplete rate limiting (B2)

**User Story:** As the platform owner, I want autocomplete generation metered, so that per-user LLM spend is bounded.

#### Acceptance Criteria

1. THE Repository SHALL define a daily autocomplete limit of 30 in `DAILY_LIMITS`.
2. WHEN the Autocomplete_Handler receives a request, THE Autocomplete_Handler SHALL enforce the autocomplete limit via the Rate_Limiter.
3. IF the autocomplete limit is exceeded, THEN THE Autocomplete_Handler SHALL reject the request with a rate-limit response.
4. THE Autocomplete_Handler SHALL emit error copy that references the active embedding and generation providers rather than "Missing GEMINI_API_KEY".
5. THE Repository SHALL replace "Missing GEMINI_API_KEY" error copy in the `consistency/check`, `narrator`, and `demo/chat` route handlers with copy referencing the active providers.

### Requirement 8: Phase 1 — Demo chat throttling (B3)

**User Story:** As the platform owner, I want the public demo chat throttled, so that it cannot be scripted as a free LLM proxy.

#### Acceptance Criteria

1. WHEN the Demo_Chat_Handler receives a request, THE Demo_Chat_Handler SHALL apply IP-based throttling using the middleware auth-rate-limit pattern.
2. THE Demo_Chat_Handler SHALL enforce a hard daily global request cap as a circuit breaker.
3. IF the IP-based throttle or the global daily cap is exceeded, THEN THE Demo_Chat_Handler SHALL reject the request.

### Requirement 9: Phase 1 — Eval webhook fail-closed auth (B4)

**User Story:** As the platform owner, I want the eval webhook to fail closed, so that an unset secret cannot expose service-role writes in production.

#### Acceptance Criteria

1. IF the `EVAL_WEBHOOK_SECRET` environment variable is unset, THEN THE Eval_Webhook_Handler SHALL reject the request.
2. WHERE the runtime environment is not `development`, THE Grimoire_App SHALL reject requests to all `/api/eval/*` routes.
3. WHEN a request presents a secret that does not match `EVAL_WEBHOOK_SECRET`, THE Eval_Webhook_Handler SHALL reject the request.

### Requirement 10: Phase 1 — Backend Sentry monitoring (C1/C2)

**User Story:** As the platform owner, I want server and edge errors reported to Sentry, so that backend failures are observable in production.

#### Acceptance Criteria

1. THE Repository SHALL contain an `instrumentation.ts` file that exports a `register` function loading the server and edge Sentry configurations.
2. THE `instrumentation.ts` file SHALL export an `onRequestError` handler.
3. THE Grimoire_App SHALL wrap the `souls/chat`, `souls/generate`, `lore/ingest`, `consistency/check`, `narrator`, `tavern`, `entities/merge`, and `worlds/[id]/export` route handlers with `withErrorMonitoring`.
4. WHEN a wrapped route handler throws an unhandled error, THE Sentry_Monitor SHALL report the error event to Sentry.

### Requirement 11: Phase 1 — Settings toggles wired (A3)

**User Story:** As a writer, I want the typewriter-scrolling and toolbar-auto-hide toggles to take effect, so that flipping a switch changes editor behavior.

#### Acceptance Criteria

1. WHEN `toolbarAutoHide` is enabled, THE Immersive_Toolbar SHALL pass the auto-hide timeout to Toolbar_Visibility so the toolbar hides after inactivity.
2. WHILE `toolbarAutoHide` is disabled, THE Immersive_Toolbar SHALL keep the toolbar visible without auto-hiding.
3. WHILE `typewriterScrolling` is enabled, WHEN the selection changes in the Editor, THE Editor SHALL scroll the cursor line to the vertical center of the viewport.
4. WHILE `typewriterScrolling` is disabled, THE Editor SHALL leave scroll position unchanged on selection change.
5. THE Focus_Mode_Store SHALL retain both the `typewriterScrolling` and `toolbarAutoHide` preferences (neither is deleted).

### Requirement 12: Phase 1 — Reduced-motion on immersive entry (A2)

**User Story:** As a user who prefers reduced motion, I want the immersive entry animation to respect my preference, so that entry does not play a full blur-and-scale animation.

#### Acceptance Criteria

1. WHILE the user's `prefers-reduced-motion` setting is active, WHEN the Immersive_Portal mounts, THE Immersive_Portal SHALL select reduced-motion animation variants.
2. WHEN the `prefers-reduced-motion` setting changes, THE Immersive_Portal SHALL reactively re-select the appropriate animation variants at render time.

### Requirement 13: Phase 2 — Mobile navigation completeness (D1)

**User Story:** As a mobile user, I want to reach all seven sections, so that Tavern and Narrator's Tools are not unreachable.

#### Acceptance Criteria

1. THE Mobile_Nav SHALL make all seven navigation sections reachable.
2. THE Mobile_Nav SHALL display the first five sections directly and expose the remaining sections through a "More" affordance.
3. WHEN the user activates the "More" affordance, THE Mobile_Nav SHALL open the More_Sheet listing the remaining sections.
4. THE Repository SHALL port the bottom-sheet pattern from `components/aether/aether-dock.tsx` before deleting that component.
5. THE Repository SHALL delete `components/aether/aether-dock.tsx` after the More_Sheet pattern is ported.

### Requirement 14: Phase 2 — Upgrade CTAs to waitlist (D2)

**User Story:** As an interested user, I want the "Upgrade to Pro" actions to capture my interest, so that I reach a functional destination rather than a dead page.

#### Acceptance Criteria

1. THE Grimoire_App SHALL provide a Waitlist_Capture destination that accepts an email address.
2. WHEN a user submits an email address to the Waitlist_Capture, THE Waitlist_Capture SHALL record the submitted email address.
3. IF a submitted email address is not a valid email format, THEN THE Waitlist_Capture SHALL reject the submission with a validation message.
4. THE Grimoire_App SHALL route all five Upgrade_CTA controls (in `world-settings-drawer.tsx`, `user-nav.tsx`, `rate-limit-modal.tsx`, and `tavern-chat.tsx` at two sites) to the Waitlist_Capture.
5. THE Grimoire_App SHALL remove routing of any Upgrade_CTA to `/dashboard/settings#billing`.

### Requirement 15: Phase 2 — Remove "coming soon" soul-chat buttons (D3)

**User Story:** As a soul-chat user, I want only functional controls shown, so that I am not offered buttons that do nothing.

#### Acceptance Criteria

1. THE Echoes_Interface SHALL remove the Bookmark control that displays a "Coming soon" toast.
2. THE Echoes_Interface SHALL remove the Inspire control that displays a "Coming soon" toast.

### Requirement 16: Phase 2 — Account deletion compliance path (D4)

**User Story:** As a user in the EU, I want a way to request account deletion, so that the product meets minimum GDPR expectations.

#### Acceptance Criteria

1. THE Account_Settings SHALL replace the disabled "coming soon" deletion button with instructions to email `support@grimoire.pro` to delete the account.
2. THE Docs SHALL document the manual account-deletion cascade covering the `profiles` and `worlds` root records.

### Requirement 17: Phase 2 — Toolbar touch recovery (D5)

**User Story:** As a touch-device user, I want to re-summon the immersive toolbar, so that it is not permanently lost after auto-hiding.

#### Acceptance Criteria

1. THE Toolbar_Visibility SHALL listen for `touchstart` events in addition to `mousemove` and `keydown`.
2. WHILE the Immersive_Toolbar is hidden, WHEN a `touchstart` event occurs, THE Immersive_Toolbar SHALL become visible again.

### Requirement 18: Phase 2 — Dead code removal (E)

**User Story:** As a maintainer, I want unused components and modules deleted, so that the codebase contains only referenced code.

#### Acceptance Criteria

1. THE Repository SHALL delete the Dead_Component files `components/lore/lore-editor.tsx`, `components/souls/soul-chat-interface.tsx`, `components/dashboard/account-settings-panel.tsx`, `components/dashboard/world-card.tsx`, `components/landing/social-proof-strip.tsx`, `components/bible/entity-grid.tsx`, `components/layout/world-right-panel.tsx`, `components/lore/lore-search-panel.tsx`, `components/shared/ambient-particles.tsx`, and `lib/gemini.ts`.
2. THE Repository SHALL remove the `soundscape` dead state from `lib/stores/focus-mode-store.ts`.
3. WHEN `next build` runs after the deletions, THE Grimoire_App SHALL build successfully.

### Requirement 19: Phase 2 — Theme-discipline and sitemap (H)

**User Story:** As a maintainer, I want hardcoded colors replaced and the sitemap completed, so that theming is consistent and all public pages are indexed.

#### Acceptance Criteria

1. THE Immersive_Toolbar SHALL replace hardcoded color utilities (`bg-black/60`, `border-white/10`, `bg-white/15`) with theme-token-based styling.
2. THE `tavern-chat.tsx` component SHALL replace hardcoded `text-white` utilities with theme-token-based styling.
3. THE Grimoire_App SHALL normalize modal scrims that use `bg-black/40`–`bg-black/60` to the established `color-mix(var(--bg)…)` pattern.
4. THE Sitemap SHALL include the `/privacy` and `/terms` routes.

### Requirement 20: Phase 3 — Documentation rewrite (G)

**User Story:** As a new developer or AI agent, I want accurate documentation, so that I do not act on false claims about the stack.

#### Acceptance Criteria

1. THE Docs SHALL describe the embedding stack as HuggingFace `sentence-transformers/all-mpnet-base-v2` via `lib/embedding/service.ts` using `HF_TOKEN`, `EMBEDDING_FALLBACK_TOKEN`, and `EMBEDDING_FALLBACK_MODEL`.
2. THE Docs SHALL remove references to `GEMINI_API_KEY` and to a `@anthropic-ai/sdk` dependency.
3. THE Docs SHALL document the world collaboration, world import, onboarding state, immersive writing, and settings-refactor features.
4. THE Docs SHALL state that manual entity creation is implemented via `POST /api/entities`.
5. THE Docs SHALL remove AetherDock mobile-nav claims and describe the live mobile navigation.
6. THE Docs SHALL document the live environment variables including the HuggingFace, Sentry, PostHog, and fallback variables.

### Requirement 21: Phase 3 — Environment example file

**User Story:** As a new developer, I want an example environment file, so that I can configure the app without reading stale prose.

#### Acceptance Criteria

1. THE Repository SHALL contain a root `Env_Example` file.
2. THE Env_Example SHALL list all live environment variables with explanatory comments.

### Requirement 22: Phase 3 — README rewrite

**User Story:** As a new developer, I want a real README, so that I can understand the stack, set up the project, and deploy it.

#### Acceptance Criteria

1. THE Repository SHALL replace the create-next-app boilerplate `README.md` with project-specific content.
2. THE `README.md` SHALL document the technology stack, setup steps for Supabase and Inngest and environment configuration, development commands, and deploy notes.

### Requirement 23: Phase 3 — Route-handler tests

**User Story:** As a maintainer, I want tests for the endpoints changed in Phase 1, so that their new behavior is locked down.

#### Acceptance Criteria

1. THE Repository SHALL contain route-handler tests for the merge, import, autocomplete, demo-chat, and eval-webhook endpoints.
2. THE Repository SHALL remove or populate the empty `tests/integration`, `tests/ui`, and `tests/unit` directories.
3. WHEN `vitest run` executes, THE Repository SHALL pass the route-handler tests.

### Requirement 24: Phase 3 — Launch checklist

**User Story:** As a Reviewer, I want a launch checklist, so that production deployment steps are verifiable.

#### Acceptance Criteria

1. THE Docs SHALL contain a launch checklist that includes running all migrations against production Supabase, setting production environment variables (including `INNGEST_EVENT_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, and the PostHog key), and confirming `.vercelignore` excludes the sidecar.
2. THE launch checklist SHALL include a smoke test covering signup, world creation, lore inscription, soul forging, chat, tavern, and export on the deployed URL.
3. THE launch checklist SHALL include verifying that a thrown route error reaches Sentry and that rate-limit modals fire.
