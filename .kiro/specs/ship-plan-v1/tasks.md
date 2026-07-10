# Implementation Plan: ship-plan-v1

## Overview

This plan converts the ship-plan-v1 design into incremental coding tasks across
the four ship phases. Each phase is ordered to end in a green `next build`:

- **Phase 0** unbreaks the repo (line endings, litter, package.json, CI).
- **Phase 1** fixes product-blocking bugs and cost/abuse holes, wires Sentry, and
  completes the two dead settings toggles.
- **Phase 2** repairs dead-end UX, removes dead code, and fixes theme discipline.
- **Phase 3** rewrites docs, adds route-handler tests, and produces the launch
  checklist.

Language: TypeScript / TSX / SQL, matching the existing codebase. Optional
sub-tasks are marked with `*`. Property tests reference the three correctness
properties from the design.

## Tasks

- [x] 1. Phase 0 — Line endings and repo litter
  - [x] 1.1 Add `.gitattributes` and renormalize line endings
    - Create root `.gitattributes` declaring `* text=auto` and `eol=lf` for `.ts`, `.tsx`, `.css`, `.md`, `.json`, `.sql`
    - Run `git add --renormalize .` and commit the renormalization so `git diff --ignore-all-space --stat` is empty
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Remove root litter and update `.gitignore`
    - Delete `test-soul.mjs`, `scripts/test-gemini.mjs`, `tsc-output.txt`, `models.json`, and the `scratch/` directory
    - Add `tsc-output.txt`, `.env`, `.env.*`, and `!.env.example` patterns to `.gitignore`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Phase 0 — package.json hygiene and CI
  - [x] 2.1 Update `package.json` scripts, engines, and dependencies
    - Add `"typecheck": "tsc --noEmit"` to `scripts`
    - Add top-level `"engines": { "node": ">=20" }`
    - Remove `@google/generative-ai` from `dependencies`; verify `lucide-react` resolves on clean install
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Add GitHub Actions CI workflow
    - Create `.github/workflows/ci.yml` running install, lint, `typecheck`, `vitest run`, `next build` in sequence on push and pull_request
    - Supply placeholder `NEXT_PUBLIC_SUPABASE_*` build env; exclude `eval:service` and `eval:setup`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3. Checkpoint — Phase 0 green build
  - Verified: `npm run lint` clean, `npm run typecheck` clean, `npx vitest run` 300 passed / 1 skipped, `npm run build` exit 0.
  - Extra fix required to make the new typecheck gate green: gave `requireUser` an explicit discriminated-union return type (was leaking `undefined` into handler return types), aligned the 3 eval routes to the `"error" in auth` guard, added explicit `Promise<Response>` return type to the dashboard `GET`, and fixed a `Symbol.toStringTag` index cast in `tests/dashboard-query.test.ts`.

- [x] 4. Phase 1 — Entity merge tag remap (A1)
  - [x] 4.1 Create the `replace_entity_tag` SQL migration
    - Add `supabase/migrations/<timestamp>_replace_entity_tag.sql` defining `replace_entity_tag(p_world_id, p_old_tag, p_new_tag)` as `security invoker`, using `array_replace` + `array_agg(distinct …)` scoped by the `@>` guard
    - _Requirements: 5.1_

  - [x] 4.2 Wire the RPC into the merge handler and delete the duplicate route
    - In `app/api/entities/merge/route.ts`, replace the fire-and-forget `.then(() => {})` with a checked `supabase.rpc("replace_entity_tag", …)` call that returns `500 TAG_REMAP_FAILED` on error, before deleting the secondary entity
    - Delete the duplicate route `app/api/entities/[id]/merge/route.ts`
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x]* 4.3 Write property test for tag remap
    - **Property 1: Entity-tag remap moves all source tags to the target**
    - **Validates: Requirements 5.4**

  - [x]* 4.4 Write route-handler test for merge
    - Seed two entities + tagged chunks; assert the RPC is invoked and the target name replaces the source name; assert 500 when the RPC stub errors
    - _Requirements: 5.6_

- [x] 5. Phase 1 — World import metering and access (B1)
  - [x] 5.1 Add access guard, free-tier cap, and per-entry metering to the import handler
    - In `app/api/worlds/[id]/import/route.ts`, replace the raw `user_id` check with `requireWorldAccess(..., "editor")` (403 on deny)
    - Reject when existing + batch would exceed `FREE_TIER_LIMITS.loreEntries` (50)
    - Call `checkAndIncrement(..., "lore_ingest", ...)` per successful insert and short-circuit with `jsonRateLimited` when exhausted
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 5.2 Write route-handler test for import
    - Assert 403 for non-editor, 50-entry cap rejection, and 429 short-circuit on limiter exhaustion
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 6. Phase 1 — Autocomplete rate limiting and provider error copy (B2)
  - [x] 6.1 Add autocomplete limit and enforce it in the handler
    - Add `autocomplete: 30` to `DAILY_LIMITS` in `lib/constants.ts`
    - In `app/api/lore/autocomplete/route.ts`, call `checkAndIncrement(..., "autocomplete", DAILY_LIMITS.autocomplete)` after auth and return `jsonRateLimited` when exceeded
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Fix provider-accurate error copy across handlers
    - Replace "Missing GEMINI_API_KEY" copy in `autocomplete`, `consistency/check`, `narrator`, and `demo/chat` handlers with copy referencing Groq (generation) and HuggingFace (embeddings)
    - _Requirements: 7.4, 7.5_

  - [x]* 6.3 Write route-handler test for autocomplete
    - Assert 429 when `checkAndIncrement` returns `allowed: false` and provider-accurate copy when AI env is absent
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 7. Phase 1 — Demo chat throttling (B3)
  - [x] 7.1 Add reusable IP/global rate limiter
    - Create `lib/rate-limit-ip.ts` exposing `checkIpRateLimit(key, ip, {windowMs, max})` and `checkGlobalDailyCap(key, max)`, reusing the sliding-window Map design from `lib/middleware/auth-rate-limit.ts`
    - _Requirements: 8.1, 8.2_

  - [x] 7.2 Apply per-IP throttle and global cap in the demo chat handler
    - In `app/api/demo/chat/route.ts`, derive IP via `getClientIp`, enforce `checkIpRateLimit("demo_chat", ip, {windowMs: 60_000, max: 8})` and `checkGlobalDailyCap("demo_chat", 5_000)` before calling Groq; reject with 429 when exceeded
    - _Requirements: 8.1, 8.2, 8.3_

  - [x]* 7.3 Write property test for rate limits
    - **Property 2: IP and global rate limits never allow more than their maximum**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x]* 7.4 Write route-handler test for demo chat
    - Assert per-IP throttle and global-cap 429s using a reset store; msw mocks the Groq stream
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 8. Phase 1 — Eval webhook fail-closed auth (B4)
  - [x] 8.1 Fail closed in the eval webhook handler
    - In `app/api/eval/webhook/route.ts`, return 503 when `EVAL_WEBHOOK_SECRET` is unset and 403 when the presented secret does not match
    - _Requirements: 9.1, 9.3_

  - [x] 8.2 Gate all `/api/eval/*` routes outside development
    - In `middleware.ts`, reject `/api/eval/*` traffic with a 404 (plus security headers) when `NODE_ENV !== "development"`, before session refresh
    - _Requirements: 9.2_

  - [x]* 8.3 Write route-handler test for eval webhook
    - Assert 503 when secret unset, 403 on mismatch, and success on match
    - _Requirements: 9.1, 9.3_

- [x] 9. Phase 1 — Backend Sentry monitoring (C1/C2)
  - [x] 9.1 Create `instrumentation.ts`
    - Add root `instrumentation.ts` with `register()` that runtime-switches loading of `sentry.server.config` / `sentry.edge.config`, and re-export `captureRequestError as onRequestError`
    - _Requirements: 10.1, 10.2_

  - [x] 9.2 Wrap the eight highest-risk routes with `withErrorMonitoring`
    - Wrap `souls/chat`, `souls/generate`, `lore/ingest`, `consistency/check`, `narrator`, `tavern`, `entities/merge`, and `worlds/[id]/export`, keeping `params` in closure for dynamic routes
    - _Requirements: 10.3, 10.4_

- [x] 10. Phase 1 — Settings toggles wired (A3)
  - [x] 10.1 Wire `toolbarAutoHide` and add touch recovery to Toolbar_Visibility
    - Extend `useToolbarVisibility(timeoutMs, enabled)` to keep the toolbar pinned when disabled and add a passive `touchstart` activity listener (with cleanup)
    - In `components/lore/immersive-toolbar.tsx`, read `toolbarAutoHide` from the focus-mode store and pass it as the `enabled` flag
    - _Requirements: 11.1, 11.2, 17.1, 17.2_

  - [x] 10.2 Implement `typewriterScrolling` hook and wire it into the editor
    - Add a `useTypewriterScrolling(editor, enabled)` hook that scrolls the cursor line to vertical center on TipTap `selectionUpdate` when enabled and is inert when disabled
    - Wire it in the immersive editor with `enabled` from `Focus_Mode_Store`; keep both preferences in the store
    - _Requirements: 11.3, 11.4, 11.5_

- [x] 11. Phase 1 — Reduced-motion on immersive entry (A2)
  - [x] 11.1 Use framer-motion `useReducedMotion` for portal variants
    - In `components/lore/immersive-portal.tsx`, replace the `useRef`/`useEffect` reduced-motion detection with `useReducedMotion()` and select reduced-motion variants reactively at render time
    - _Requirements: 12.1, 12.2_

- [x] 12. Checkpoint — Phase 1 green build
  - Verified: `npm run typecheck` exit 0, `npm run lint` exit 0, `npx vitest run` 316 passed / 1 skipped (52 files), `npm run build` exit 0.
  - Frontend races review (typewriter-scrolling hook): coalesced `selectionUpdate` scrolls to one per animation frame and switched to instant positioning to avoid stacked smooth-scroll jank.

- [x] 13. Phase 2 — Mobile navigation completeness (D1)
  - [x] 13.1 Add "5 + More" bottom sheet to the mobile nav
    - Port the AetherDock bottom-sheet pattern (backdrop + `AnimatePresence` + grid + drag handle, theme tokens) into `components/layout/world-sidebar.tsx`, rendering the first five items plus a "More" button that opens a sheet listing `items.slice(5)` (Tavern, Narrator's Tools) with existing navigation
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 13.2 Delete AetherDock after the port
    - Delete `components/aether/aether-dock.tsx` once the sheet is ported and verified
    - _Requirements: 13.5_

- [x] 14. Phase 2 — Upgrade CTAs to waitlist (D2)
  - [x] 14.1 Create the waitlist table migration and endpoint
    - Add a `waitlist` migration (`id`, `email unique`, `source`, `created_at`) with insert-only RLS for anon/authenticated
    - Create `app/api/waitlist/route.ts` (`force-dynamic`) validating with Zod, returning 400 on invalid email, upserting on the `email` unique constraint
    - _Requirements: 14.1, 14.2, 14.3_

  - [x]* 14.2 Write property test for email validation
    - **Property 3: Waitlist accepts an email if and only if it is validly formatted**
    - **Validates: Requirements 14.1, 14.3**

  - [x] 14.3 Add WaitlistDialog and route all five Upgrade CTAs to it
    - Create a `WaitlistDialog` component with an email field and inline validation
    - Open it from all five CTA sites (`world-settings-drawer.tsx`, `user-nav.tsx`, `rate-limit-modal.tsx`, `tavern-chat.tsx` ×2) and remove every `/dashboard/settings#billing` target
    - _Requirements: 14.4, 14.5_

- [x] 15. Phase 2 — Remove dead-end controls
  - [x] 15.1 Remove "coming soon" soul-chat buttons
    - In `components/souls/echoes-interface.tsx`, remove the Bookmark and Inspire buttons and any now-unused imports/handlers
    - _Requirements: 15.1, 15.2_

  - [x] 15.2 Add account-deletion compliance path
    - In `components/settings/settings-content.tsx`, replace the disabled "coming soon" delete button with an actionable `mailto:support@grimoire.pro` instruction
    - _Requirements: 16.1_

- [x] 16. Phase 2 — Dead code and theme discipline
  - [x] 16.1 Delete zero-importer modules and `soundscape` dead state
    - Delete the 10 dead modules listed in Req 18.1 (`lore-editor.tsx`, `soul-chat-interface.tsx`, `account-settings-panel.tsx`, `world-card.tsx`, `social-proof-strip.tsx`, `entity-grid.tsx`, `world-right-panel.tsx`, `lore-search-panel.tsx`, `ambient-particles.tsx`, `lib/gemini.ts`)
    - Remove the `soundscape` type, field, action, `VALID_SOUNDSCAPES`, `isValidSoundscape`, default, and validation branch from `lib/stores/focus-mode-store.ts`
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 16.2 Replace hardcoded colors with theme tokens
    - In `immersive-toolbar.tsx` replace `bg-black/60`, `border-white/10`, and the `bg-white/15`/`hover:bg-white/10` usages with token-based styling
    - In `tavern-chat.tsx` replace `text-white` with `text-[var(--text-main)]`
    - Normalize the ~9 `bg-black/40`–`bg-black/60` modal scrims to the `color-mix(var(--bg)…)` pattern
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 16.3 Add `/privacy` and `/terms` to the sitemap
    - Add both entries to `app/sitemap.ts`
    - _Requirements: 19.4_

- [x] 17. Checkpoint — Phase 2 green build
  - Verified after all deletions: `npm run typecheck` exit 0, `npm run lint` clean, `npx vitest run` 318 passed / 1 skipped (52 files), `npm run build` exit 0. The green build proves none of the 10 deleted modules were imported.
  - Note: `tests/gemini.test.ts` was deleted alongside `lib/gemini.ts` (it only tested the removed legacy shim; embeddings are covered by the embedding-service tests).

- [x] 18. Phase 3 — Documentation and environment
  - [x] 18.1 Rewrite developer documentation
    - Rewrite `CLAUDE.md` (optionally split into `docs/`): correct embeddings (HuggingFace `all-mpnet-base-v2` via `lib/embedding/service.ts`, `HF_TOKEN`/`EMBEDDING_FALLBACK_TOKEN`/`EMBEDDING_FALLBACK_MODEL`), remove `GEMINI_API_KEY`/`@anthropic-ai/sdk` claims, document collaboration/import/onboarding/immersive-writing/settings-refactor, state manual entity creation via `POST /api/entities`, describe live mobile nav, and list live env vars
    - Document the manual account-deletion cascade (`profiles`, `worlds` roots)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 16.2_

  - [x] 18.2 Create `.env.example`
    - Add a root `.env.example` listing every live variable with explanatory comments (Supabase, Groq, HuggingFace, Inngest, monitoring, eval)
    - _Requirements: 21.1, 21.2_

  - [x] 18.3 Rewrite `README.md`
    - Replace the create-next-app boilerplate with stack overview, Supabase/Inngest/env setup steps, dev commands, and deploy notes
    - _Requirements: 22.1, 22.2_

- [x] 19. Phase 3 — Tests and launch checklist
  - [x] 19.1 Clean up test directories and lock in route-handler tests
    - Ensure route-handler tests exist for merge, import, autocomplete, demo-chat, and eval-webhook (from tasks 4–8) and that `vitest run` passes
    - Remove or populate the empty `tests/integration`, `tests/ui`, and `tests/unit` directories
    - _Requirements: 23.1, 23.2, 23.3_

  - [x] 19.2 Write the launch checklist
    - Add `docs/LAUNCH.md` (or a README section) covering production migrations (including `replace_entity_tag` and `waitlist`), production env vars (`INNGEST_EVENT_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, PostHog key, etc.), `.vercelignore` sidecar exclusion, the signup→export smoke test, and Sentry/rate-limit verification
    - _Requirements: 24.1, 24.2, 24.3_

- [x] 20. Final checkpoint — full green build
  - Verified on the complete codebase: `npm run lint` exit 0, `npm run typecheck` exit 0, `npx vitest run` 318 passed / 1 skipped (52 files), `npm run build` exit 0.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP.
- Each task references specific requirement sub-clauses for traceability.
- Checkpoints (tasks 3, 12, 17, 20) enforce a green build at the end of every phase.
- Property tests validate the three correctness properties: Property 1 (tag remap, task 4.3), Property 2 (rate limits, task 7.3), Property 3 (email validation, task 14.2).
- Route-handler tests use vitest + msw with a chainable Supabase stub, per the design's testing strategy.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1", "6.1", "7.1", "9.1", "14.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "4.2", "6.2", "7.2", "8.1", "8.2", "9.2", "10.1", "11.1", "14.3"] },
    { "id": 2, "tasks": ["2.2", "4.3", "4.4", "5.1", "7.3", "10.2", "13.1", "14.2", "15.1", "15.2", "16.2", "16.3"] },
    { "id": 3, "tasks": ["5.2", "6.3", "7.4", "8.3", "13.2", "16.1"] },
    { "id": 4, "tasks": ["18.1", "18.2", "18.3", "19.1", "19.2"] }
  ]
}
```
