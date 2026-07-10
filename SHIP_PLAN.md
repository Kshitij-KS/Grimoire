# Grimoire — Ship Plan (Full-Repo Audit, July 10, 2026)

Audit method: three parallel deep scans (backend/API, frontend/components, infra/process) cross-checked against CLAUDE.md, audit_report.md, the .kiro specs, git history, and a fresh `tsc --noEmit` run (passes, 0 errors).

**Bottom line:** the product core is in good shape — auth, Zod validation, rate limiting, RLS, the hardened embedding service, and the Inngest pipeline are all correctly wired. What's left is a bounded set of real loose ends: 2 silent bugs, 4 cost/abuse holes, a handful of half-wired UI toggles, ~10 dead components, zero CI, and heavily stale docs. Roughly **2 focused weeks** to a shippable v1.

---

## Part 1 — The Actual Loose Ends

### A. Silent bugs (broken behavior users can hit today)

| # | Issue | Where | Detail |
|---|-------|-------|--------|
| A1 | **Entity merge never remaps `entity_tags`** | `app/api/entities/merge/route.ts:110-114` | Calls `supabase.rpc("replace_entity_tag")` — that RPC **has no migration** and doesn't exist. supabase-js returns the error in `{error}`, the `.then(() => {})` swallows it. Every merge silently leaves stale tags. The dead duplicate route `app/api/entities/[id]/merge/route.ts:56-73` contains a correct JS implementation — port it. |
| A2 | **`prefers-reduced-motion` ignored on immersive entry** | `components/lore/immersive-portal.tsx:81-89` | Reduced-motion match stored in a `useRef` inside `useEffect`; variants chosen at render time, so entry always plays the full blur+scale animation. A11y regression from the immersive-writing commit. |
| A3 | **Two settings toggles are no-ops** | `lib/stores/focus-mode-store.ts:15-16`, `components/settings/preferences-tab.tsx:151-186` | `typewriterScrolling` and `toolbarAutoHide` are persisted and toggleable but **never read** by any editor code (`immersive-toolbar.tsx:40` hardcodes `useToolbarVisibility(3000)`). Users flip switches that do nothing. |

### B. Cost / abuse holes (unmetered LLM spend)

| # | Issue | Where | Detail |
|---|-------|-------|--------|
| B1 | **World import bypasses rate limits AND the free-tier cap** | `app/api/worlds/[id]/import/route.ts:44-123` | Inserts up to 10 lore entries + fires 10 Inngest jobs per call with no `checkAndIncrement` and no 50-entries/world check. Fully circumvents the 10/day ingest limit. Also uses raw `user_id` ownership check instead of `requireWorldAccess(..., "editor")` — collaborators can't import. |
| B2 | **Autocomplete has no rate limit** | `app/api/lore/autocomplete/route.ts` | Groq generation endpoint; auth + Zod yes, `checkAndIncrement` no. Unbounded per-user spend. Error copy also still says "Missing GEMINI_API_KEY". |
| B3 | **Demo chat is public, unauthenticated, unthrottled** | `app/api/demo/chat/route.ts` | Intentional per docs, but there's no IP throttle at all — a trivially scriptable free Groq proxy. |
| B4 | **Eval webhook auth is skipped when secret unset** | `app/api/eval/webhook/route.ts:29-35` | Secret only enforced `if (webhookSecret)`. Unset env ⇒ anyone can write `eval_runs` via the service-role client. Dev-only feature but the route is reachable in prod (`/api/eval/*` routes are NOT NODE_ENV-gated; only the page is). |

### C. Monitoring that isn't actually on

| # | Issue | Where | Detail |
|---|-------|-------|--------|
| C1 | **Server/edge Sentry never initializes** | repo root | `@sentry/nextjs` v10 requires `instrumentation.ts` with `register()` (+ `onRequestError`). It doesn't exist — `sentry.server.config.ts` / `sentry.edge.config.ts` are never loaded. Only client-side Sentry runs. The "production-readiness" commit shipped monitoring that doesn't monitor the backend. |
| C2 | **`withErrorMonitoring` is dead code** | `lib/sentry.ts` | Exported, tested — and imported by **zero** API routes. No route reports exceptions to Sentry. |

### D. Dead-end UX (visible to users)

| # | Issue | Where |
|---|-------|-------|
| D1 | Mobile nav shows only **5 of 7** sections — Tavern and Narrator's Tools unreachable on mobile, no overflow affordance. (`world-sidebar.tsx:236` `items.slice(0, 5)`.) Ironically the *unused* `aether-dock.tsx` has a working "More" sheet pattern. |
| D2 | Five "Upgrade to Pro" CTAs (`world-settings-drawer.tsx:349`, `user-nav.tsx:58`, `rate-limit-modal.tsx:114`, `tavern-chat.tsx:78,290`) all funnel to `/dashboard/settings#billing`, which only says "coming soon". Dead-end funnel. |
| D3 | Two toolbar buttons in soul chat (`echoes-interface.tsx:488,496` — Bookmark, Inspire) do `toast.info("Coming soon.")`. |
| D4 | Account deletion: permanently disabled button labeled "coming soon" (`settings-content.tsx:139-145`). Known/intentional, but for a paid-intent SaaS in the EU this is a GDPR problem — needs at least a support-email path. |
| D5 | Toolbar auto-hide has no touch recovery — on touch devices, once hidden, the immersive toolbar can't be re-summoned (`use-toolbar-visibility.ts` only listens to `mousemove`/`keydown`). |

### E. Dead code (10 components with zero importers, plus root litter)

Delete: `components/lore/lore-editor.tsx`, `components/aether/aether-dock.tsx`*, `components/souls/soul-chat-interface.tsx`, `components/dashboard/account-settings-panel.tsx`, `components/dashboard/world-card.tsx`, `components/landing/social-proof-strip.tsx` (**contains fabricated stats — 1,284 worlds / 8,940 souls / 34 countries — a legal/PR landmine if ever re-mounted**), `components/bible/entity-grid.tsx`, `components/layout/world-right-panel.tsx`, `components/lore/lore-search-panel.tsx`, `components/shared/ambient-particles.tsx`, `app/api/entities/[id]/merge/route.ts` (after porting its tag-remap logic per A1), `lib/gemini.ts` (misnamed HuggingFace shim, zero importers).

Also delete: `test-soul.mjs`, `scratch/` (3 one-off migration scripts), `scripts/test-gemini.mjs`, `tsc-output.txt` (0 bytes), `models.json` (47 KB unused), the `soundscape` dead state in `focus-mode-store.ts`, and the `@google/generative-ai` dependency.

\* or resurrect AetherDock's "More" sheet to fix D1 — either way, don't keep both navs.

### F. Repo hygiene / process (this is what's blocked "shipping for once and for all")

| # | Issue | Detail |
|---|-------|--------|
| F1 | **95-file phantom diff: CRLF↔LF churn** | Every "modified" file in `git status` is a pure line-ending rewrite (`git diff --ignore-all-space --stat` = empty). No `.gitattributes`, `core.autocrlf` unset. This will keep re-dirtying the tree and burying real changes forever until fixed. **No actual work is uncommitted.** |
| F2 | **No CI whatsoever** | No `.github/workflows`. Nothing runs lint/typecheck/test/build on push. This is how doc drift and dead monitoring shipped unnoticed. |
| F3 | **Windows-only npm scripts** | `eval:service` (`.venv\Scripts\python.exe`) and `eval:setup` (PowerShell) break on any Linux CI. Fine locally, but they must not gate CI. |
| F4 | No `typecheck` script, no `engines` field, no root `.env.example` (env docs live only in stale CLAUDE.md prose). |
| F5 | **README is untouched create-next-app boilerplate.** |
| F6 | Tests: 26 files (~4.4k lines, embedding service well covered) but **zero API route-handler tests**, and `tests/integration|ui|unit/` are empty scaffold dirs. The 6 unchecked `.kiro` tasks are all optional property tests (fast-check already installed). |

### G. Documentation is dangerously stale (CLAUDE.md actively lies)

Any AI agent or new dev reading CLAUDE.md today will be wrong about:

- **Embeddings are NOT Gemini.** Live path is HuggingFace `sentence-transformers/all-mpnet-base-v2` via `lib/embedding/service.ts` (`HF_TOKEN`, `EMBEDDING_FALLBACK_TOKEN`, `EMBEDDING_FALLBACK_MODEL`). `GEMINI_API_KEY` docs, note #14, #19, #40 all wrong. Several routes still emit "Missing GEMINI_API_KEY" error copy.
- `@anthropic-ai/sdk` "present in package.json" — it isn't, at all.
- "Manual entity creation: Not implemented" — it exists (`POST /api/entities`).
- AetherDock mobile-nav notes (#13, feature 12) — component is dead; live nav differs.
- Entirely undocumented shipped features: **world collaboration** (members/invitations + 3 RLS migrations), world import, onboarding state, PostHog, Sentry, the settings refactor, immersive writing mode, `FractureLens` being a one-line re-export alias of `ConsistencyChecker`.
- Env var section missing 9 live vars (HF/Sentry/PostHog/fallbacks).

### H. Theme-discipline violations (own rule: no hardcoded colors)

Worst live offenders: `immersive-toolbar.tsx` (`bg-black/60`, `border-white/10`, `bg-white/15` ×5 — newest file, worst offender), `tavern-chat.tsx` (`text-white` ×4), `entity-detail-panel.tsx` (`text-green-500`), plus ~9 modal scrims using `bg-black/40-60` instead of the established `color-mix(var(--bg)…)` pattern. `sitemap.ts` also omits `/privacy` and `/terms`.

### Verified fine — no work needed

`force-dynamic` on all API routes; `requireUser`/`requireWorldAccess` consistent; Zod everywhere; all documented rate limits wired (incl. the `?inline=true` bypass); the hardened embedding service (retry/timeout/dim-validation/fallback, ~18 test files); all RPCs except `replace_entity_tag` have migrations; `eval_runs` migration exists; security headers + auth IP-throttle in middleware; PostHog no-ops without key; Sentry client config guarded; privacy/terms are real legal text (not lorem); landing page renders no fake stats (the fake ones are in dead code); error/not-found pages complete; no TODO/FIXME/console.log litter in components.

---

## Part 2 — The Plan

Four phases. Each ends in a commit and a working build. Estimates assume one experienced dev.

### Phase 0 — Unbreak the repo (½ day) — do this first, everything else depends on it

1. **Kill the CRLF churn:** add `.gitattributes` (`* text=auto` + `*.ts/tsx/css/md/json/sql text eol=lf`), run `git add --renormalize .`, discard the 95-file phantom diff, commit. Set `core.autocrlf=input` locally.
2. **Delete root litter:** `test-soul.mjs`, `scratch/`, `scripts/test-gemini.mjs`, `tsc-output.txt`, `models.json`. Add `tsc-output.txt` + `.env*` patterns to `.gitignore`.
3. **package.json:** add `"typecheck": "tsc --noEmit"`, add `"engines": { "node": ">=20" }`, remove `@google/generative-ai`, verify `lucide-react` version resolves.
4. **CI:** add `.github/workflows/ci.yml` — install, lint, typecheck, `vitest run`, `next build` on push/PR. Exclude `eval:*` scripts (Windows-only, dev-only).

### Phase 1 — Fix the bugs & holes (2–3 days) — the actual product blockers

1. **A1 merge bug:** replace the phantom `replace_entity_tag` RPC call with the working JS tag-remap from the dead route (or write the RPC + migration). Add a route-handler test that merges two entities and asserts tags moved. Then delete the dead duplicate route.
2. **B1 import:** add `checkAndIncrement` (count each imported file against `lore_ingest`), enforce the 50-entry free-tier cap, switch to `requireWorldAccess(..., "editor")`.
3. **B2 autocomplete:** add a rate limit (suggest new `DAILY_LIMITS.autocomplete: 30`); fix the Gemini error copy here and in `consistency/check`, `narrator`, `demo/chat`.
4. **B3 demo chat:** add IP-based throttling (reuse the middleware auth-rate-limit pattern) + a hard daily global cap as circuit breaker.
5. **B4 eval webhook:** fail closed — reject if `EVAL_WEBHOOK_SECRET` unset; gate all `/api/eval/*` routes on `NODE_ENV === "development"` to match the page.
6. **C1/C2 Sentry:** create `instrumentation.ts` with `register()` loading the server/edge configs + export `onRequestError`; wrap the ~8 highest-risk routes (`souls/chat`, `souls/generate`, `lore/ingest`, `consistency/check`, `narrator`, `tavern`, `entities/merge`, `worlds/[id]/export`) with `withErrorMonitoring`. Verify one test event reaches Sentry from a route.
7. **A3 toggles:** wire `toolbarAutoHide` into `immersive-toolbar.tsx` (pass pref to `useToolbarVisibility`; `Infinity`/disabled when off). For `typewriterScrolling`: implement (scroll cursor block to vertical center on selection change) **or delete the toggle** — don't ship a dead switch. Deleting is acceptable for v1.
8. **A2 reduced motion:** use `useReducedMotion()` from framer-motion (render-time, reactive) to select portal variants.

### Phase 2 — UX dead ends + dead code (2–3 days)

1. **D1 mobile nav:** show all 7 sections — either a 5+"More" bottom-sheet (port the pattern from `aether-dock.tsx` before deleting it) or a horizontally scrollable nav. Then delete AetherDock.
2. **D2 upgrade CTAs:** decision point — (a) hide all "Upgrade" CTAs behind a `BILLING_ENABLED` flag (recommended for v1), or (b) point them at a waitlist email capture. Never funnel to a dead page.
3. **D3:** remove the Bookmark/Inspire "coming soon" buttons from `echoes-interface.tsx`.
4. **D4 account deletion:** minimum viable compliance — replace the disabled button with "Email support@grimoire.pro to delete your account" + document the manual cascade (the FK `ON DELETE CASCADE` hardening from Phase 1 migrations covers most of it; audit `profiles`/`worlds` roots). Full self-serve deletion can be post-launch.
5. **D5:** add `touchstart` to `use-toolbar-visibility.ts` listeners.
6. **E dead code:** delete all 10 unused components + `lib/gemini.ts` (esp. `social-proof-strip.tsx` with its fabricated stats). One commit, `npm run build` proves nothing broke.
7. **H theme:** fix `immersive-toolbar.tsx` and `tavern-chat.tsx` hardcoded colors; normalize modal scrims to the `color-mix` pattern; add `/privacy` + `/terms` to `sitemap.ts`.

### Phase 3 — Docs, tests, launch checklist (2–3 days)

1. **Rewrite CLAUDE.md** (or split into `docs/`): correct the embedding stack (HuggingFace), env vars (add HF/Sentry/PostHog/fallback vars, remove Gemini), document collaboration/import/onboarding/immersive/settings, delete false claims (@anthropic-ai/sdk, AetherDock, "manual entity creation not implemented"). This directly improves every future AI-assisted session on this repo.
2. **Root `.env.example`** with all ~15 live vars, commented.
3. **Real README:** stack, setup (Supabase, Inngest, env), dev commands, deploy notes.
4. **Route-handler tests** for the endpoints touched in Phase 1 (merge, import, autocomplete, demo chat, eval webhook) — these are the ones that just changed, so they're the ones that need locking down. Remove the empty `tests/integration|ui|unit/` dirs or populate them.
5. Optional: the 6 unchecked fast-check property tests from the ui-polish spec (nice-to-have; fast-check is installed).
6. **Launch checklist:** run all migrations against prod Supabase; set prod env (incl. real `INNGEST_EVENT_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, PostHog key); confirm `.vercelignore` excludes the sidecar; smoke-test signup → create world → inscribe lore → forge soul → chat → tavern → export on the deployed URL; verify a thrown route error lands in Sentry; verify rate-limit modals fire.

### Explicitly deferred (post-launch, unchanged from known gaps)

Stripe billing, self-serve account deletion, world soft-delete, Markdown/ZIP export, lore-edit-vs-reingest optimization, `FractureLens`/`ConsistencyChecker` true consolidation, world-workspace decomposition.

### Effort summary

| Phase | Scope | Est. |
|-------|-------|------|
| 0 | Repo unbreak + CI | 0.5 day |
| 1 | Bugs, cost holes, Sentry | 2–3 days |
| 2 | UX dead ends, dead code, theme | 2–3 days |
| 3 | Docs, tests, launch checklist | 2–3 days |
| **Total** | | **~7–10 working days** |
