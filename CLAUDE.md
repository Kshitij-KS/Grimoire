# Grimoire — Project Bible

## Vision

Grimoire is a **dark fantasy worldbuilding SaaS** for fiction writers and game masters who build lore-heavy worlds. It is an enchanted tome — a living archive where every word written becomes structured, searchable memory, and characters forged from that lore can speak in their own voices.

The aesthetic is **dark parchment, warm candlelight, arcane purple** — NOT cold space, NOT tech-blue, NOT SaaS-grey. Every interaction should feel like casting a spell, not clicking a dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (TypeScript) |
| Styling | Tailwind CSS + shadcn/ui + Framer Motion |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Database | Supabase PostgreSQL + pgvector (768-dim embeddings) + RLS |
| AI — Generation | Groq (`llama-3.3-70b-versatile` for heavy tasks, `llama-3.1-8b-instant` for fast/streaming) |
| AI — Embeddings | HuggingFace Inference API (`sentence-transformers/all-mpnet-base-v2`, 768-dim) — embeddings ONLY |
| Background Jobs | Inngest (multi-step functions, retry/backoff, dead-letter queue) |
| Rich Text | TipTap (StarterKit + CharacterCount + Placeholder + Highlight) |
| State | Zustand (`useWorkspaceStore`, `useDraftStore`, `useAmbientStore`, `useFocusModeStore`) |
| Forms | React Hook Form + Zod |
| Command Palette | cmdk |
| Notifications | Sonner |
| Monitoring | Sentry (`@sentry/nextjs`) + PostHog (`posthog-js`, cookieless) |

**Important — the AI provider split:**

- **Generation runs on Groq.** All text generation (soul generation, soul chat, entity
  extraction, consistency checks, impact analysis, blank-spot detection, timeline
  ordering, tavern responses, autocomplete, demo chat) goes through `lib/groq.ts`.
  `GROQ_API_KEY` is required on the server for any generation to work.
- **Embeddings run on HuggingFace.** Vector embeddings are produced by the hardened
  Embedding_Service in `lib/embedding/service.ts`, which calls the HuggingFace
  Inference API model `sentence-transformers/all-mpnet-base-v2` (768-dim, matching the
  `vector(768)` pgvector columns). It uses `HF_TOKEN` (optional — anonymous access works
  but is rate-limited) and an optional fallback provider configured with
  `EMBEDDING_FALLBACK_TOKEN` + `EMBEDDING_FALLBACK_MODEL`.
- **There is NO Gemini and NO Anthropic.** `GEMINI_API_KEY` is not used anywhere, and
  `@anthropic-ai/sdk` is not a dependency. Do not reintroduce either. Provider-facing
  error copy should reference Groq (generation) and HuggingFace (embeddings).

### Embedding_Service (`lib/embedding/service.ts`)

The embedding path is hardened and centralized:

- `validateInput()` rejects empty/whitespace-only or over-length text (max 8192 chars)
  before any provider is contacted.
- `callWithRetry()` drives a provider with bounded exponential backoff (1s → 2s → 4s …,
  capped at 60s) and a per-request timeout, classifying failures into one of five
  categories. `dimension-mismatch` and `invalid-input` are terminal (never retried).
- `validateDimension()` enforces the 768-element requirement on every returned vector.
- On primary exhaustion, requests route to the configured fallback provider when both
  `EMBEDDING_FALLBACK_TOKEN` and `EMBEDDING_FALLBACK_MODEL` are set; otherwise the
  primary error is raised.
- Config resolution lives in `lib/env.ts` (`getEmbeddingConfig()`, `isFallbackConfigured()`).

---

## Features

### 1. Lore Scribe — The Enchanted Editor

**What it does:** A rich text editor where writers pour their world's lore. When submitted, the text is sent to Inngest for background processing (chunked, embedded into pgvector, entities extracted). Falls back to synchronous SSE if Inngest is unavailable.

**Implementation:**
- TipTap editor (`components/lore/loom-editor.tsx`) with heading/bold/italic/blockquote/list support
- Title + content saved as a `lore_entries` record with `processing_status` field
- **Primary path:** POST `/api/lore/ingest` → sends `lore.inscribed` event to Inngest → returns `{ entry, processing: "background", eventId }`
- **Fallback path:** SSE stream if Inngest unavailable
- Processing status polled via GET `/api/lore/status?entryId=` for background jobs
- Lore entry CRUD: PATCH/DELETE `/api/lore/[id]`
- Lore entries can be organized into **folders** (CRUD via `/api/lore/folders`)
- Semantic search: POST `/api/lore/search` — embedding similarity via `match_lore_chunks` RPC
- **Oracle's Whisper:** POST `/api/lore/autocomplete` — AI writing continuation suggestions (Groq)
- Ctrl+S / Cmd+S keyboard shortcut to inscribe
- **Offline auto-save:** `useDraftStore` (Zustand, persisted to localStorage)

**Rate limits:** 10 lore ingest/day · 30 autocomplete/day
**Free tier cap:** 50 lore entries per world

**Key copy:** "Inscribe & Remember" (button), "Inscribing..." (loading)

### 2. Immersive Writing Mode

**What it does:** A distraction-free full-screen writing surface layered over the Lore Scribe editor, with ambient atmosphere and a minimal auto-hiding toolbar.

**Implementation:**
- `components/lore/immersive-portal.tsx` — full-screen portal; toggled via the editor's focus button or **Ctrl+Shift+F / Cmd+Shift+F**. Uses framer-motion's `useReducedMotion()` to select reduced-motion entry variants reactively at render time.
- `components/lore/immersive-toolbar.tsx` — minimal floating toolbar. Visibility is driven by `useToolbarVisibility(timeoutMs, enabled)` (`lib/hooks/use-toolbar-visibility.ts`), which listens for `mousemove`, `keydown`, and `touchstart` so the toolbar can be re-summoned on touch devices.
- `components/lore/ambient-layer.tsx` — purely decorative atmospheric layers; intensity from `ambientIntensity`.
- Preferences live in **`lib/stores/focus-mode-store.ts`** (`useFocusModeStore`, persisted to localStorage with corruption-safe validation):
  - `isImmersive`, `ambientIntensity` (`subtle`/`medium`/`vivid`), `showParagraphFocus`
  - `toolbarAutoHide` (default `true`) — when enabled, the toolbar hides after 3s of inactivity; when disabled it stays pinned
  - `typewriterScrolling` (default `false`) — when enabled, the cursor line scrolls to vertical center on selection change via `useTypewriterScrolling(editor, enabled)` (`lib/hooks/use-typewriter-scrolling.ts`); inert when disabled

### 3. The Archive (World Bible) — Entity Memory

**What it does:** Automatically extracts and organizes entities from lore into a browsable archive with four view modes: Constellation, Codex, Web, and Scroll.

**Implementation:**
- Entities in `entities` table: type, name, summary, mention_count, entity_tags
- `ArchiveWorkspace` — top-level orchestrator with 4 view modes + Oracle reveal + PNG export
- `ConstellationCanvas`, `ConstellationDossier`, `ArchiveCodex`, `ArchiveWeb`, `ArchiveScroll`
- **Manual entity creation:** POST `/api/entities` — `{ worldId, name, type, summary? }`, Zod-validated, requires `editor` access, normalizes the name for dedup (409 on conflict)
- Entity CRUD: DELETE/PATCH `/api/entities/[id]` — uses `entityPatchSchema` from `lib/entity-validation.ts`
- Entity merge: POST `/api/entities/merge` — merges two entities and remaps `entity_tags` across `lore_chunks` via the `replace_entity_tag` RPC
- Entity relationships stored in `entity_relationships` table via POST `/api/relationships`
- **Incremental Refresh:** GET `/api/entities?worldId=<id>&since=<ISO>`

**Entity types:** character, location, faction, artifact, event, rule

### 4. Bound Souls — Character AI Personas

**What it does:** Forge characters into AI personas with voice, memory, secrets, and knowledge shaped by the lore. Chat with them directly.

**Soul Card structure (JSONB):** `voice`, `core`, `knows` (5-8), `doesnt_know` (3-5), `relationships` (3-5), `secrets` (2-3), `sample_lines` (exactly 3)

**Implementation:**
- POST `/api/souls/generate` — Groq `llama-3.3-70b-versatile`, Zod-validated via `lib/soul-card.ts` + `repairAndParseJSON`
- POST `/api/souls/chat` — **semantic cache layer** (pgvector similarity on recent prompts, threshold 0.98); cache misses stream via Groq `llama-3.1-8b-instant` and are cached post-stream. Prompt embeddings are produced by the HuggingFace Embedding_Service.
- Soul-specific chat clear: DELETE `/api/souls/[id]/chat`
- Manual overrides: PATCH `/api/souls/[id]`; soul delete: DELETE `/api/souls/[id]`
- Source attribution: `source_chunk_ids` on messages; memory imprinting via `detectDeclarativeFact()`

**Rate limits:** 3 soul generate/day, 5 chat messages/day

### 5. The Tapestry — Chronological Timeline

- POST `/api/narrator` with `action: "timeline"` → `orderEventsChronologically()` (Groq `llama-3.3-70b-versatile`), grouped into eras. Component: `components/tapestry/tapestry-timeline.tsx`. Built-in `isDemo` mock bypass.

### 6. The Tavern — Multi-Soul Chat

- Sessions in `tavern_sessions`, messages in `tavern_messages`
- GET/POST `/api/tavern` — list/create sessions and post messages (`generateTavernResponse()`)
- 2 souls use a single Duo call with enforced turn order; 3+ souls use parallel isolated generation
- **Daily limit:** 30 tavern messages/day (`DAILY_LIMITS.tavern_message`)
- **Session limit:** free tier 3 souls per session (Pro up to 4)
- Component: `components/tavern/tavern-chat.tsx`

### 7. The Narrator's Eye — Consistency Radar

- POST `/api/consistency/check` — dual retrieval (embedding similarity + entity-tag overlap), Groq contradiction analysis → `ConsistencyFlag[]` with severity
- Flags stored in `consistency_flags`; resolve via POST `/api/consistency/resolve`, undo via POST `/api/consistency/unresolve`
- Components: `FractureLens` (main UI), `FlagCard`

**Rate limit:** 5 checks/day

### 8. Narrator's Tools — What-If & Lore Holes

- POST `/api/narrator`: `action: "impact"` → `analyzeImpact()`; `action: "blank-spots"` → `detectBlankSpots()`; `action: "timeline"` → `orderEventsChronologically()`
- All `ImpactResult` fields are optional — always use optional chaining
- Component: `components/narrator/narrator-tools.tsx`

### 9. World Collaboration (Members & Invitations)

**What it does:** World owners can invite collaborators as **editors** or **viewers** and manage membership. Access is enforced by RLS and the `requireWorldAccess` helper.

**Implementation:**
- Tables: `world_members` (`role: editor|viewer`, unique on `(world_id, user_id)`) and `world_invitations` (token-based, 7-day expiry, `accepted_at`) — migration `20260415000100_world_collaboration.sql`
- `GET/POST /api/worlds/[id]/members` — owner lists members + pending invitations, or sends an invite `{ email, role }` (creates a `world_invitations` row)
- `DELETE /api/worlds/[id]/members/[userId]` — owner removes a member (cannot remove self)
- `GET/POST /api/invitations/[token]` — validate an invite, then accept it (inserts a `world_members` row and marks the invitation accepted)
- **Access model** (`lib/world-access.ts`): `getWorldAccessRole()` returns `owner` (via `worlds.user_id`) / `editor` / `viewer` (via `world_members`); `requireWorldAccess(supabase, userId, worldId, minimumRole)` gates routes by rank (`viewer < editor < owner`). Used by import, manual entity creation, incremental entity fetch, etc.
- **RLS:** members can read shared worlds and their lore/entities/souls/consistency; editor members can insert lore entries. Owner manages members and invitations.

### 10. World Import & Export

**What it does:** Bulk-import `.txt`/`.md` lore files into a world, and export a full world as JSON.

**Implementation:**
- POST `/api/worlds/[id]/import` — multipart form upload (`files`), max 10 files, 500 KB each, `.txt`/`.md` only. Requires **editor** access via `requireWorldAccess(..., "editor")`. Validates files, rejects up front if the batch would exceed the 50-entry free-tier cap, then meters **each** imported entry against the per-user `lore_ingest` daily limit via `checkAndIncrement` (short-circuits with a 429 when exhausted). Each entry is inserted `processing_status: "pending"` and fires a best-effort `lore.inscribed` Inngest event.
- GET `/api/worlds/[id]/export` — full world JSON export (lore, entities, souls, consistency, tavern, chat history), wrapped with Sentry error monitoring.

### 11. Onboarding State

**What it does:** Guides new users through their first world in 4 sequential steps, persisted across sessions.

**Implementation:**
- Steps defined in `lib/onboarding-steps.ts`: `write-lore` → `view-entity` → `forge-soul` → `chat-soul`. `OnboardingState` = `{ currentStep, completedSteps[4], dismissed, finished }`.
- Persisted in the `profiles.onboarding_state` JSONB column (migration `20260528000100_onboarding_state.sql`)
- `useOnboarding({ userId, worldId })` (`lib/hooks/use-onboarding.ts`) loads/persists state, advances steps, polls for extracted entities on step 2, and supports dismiss/resume
- UI: `components/shared/onboarding-panel.tsx` (`OnboardingPanel`)

### 12. Account Settings (Refactored)

**What it does:** Account management at `/dashboard/settings`, organized into tabs.

**Implementation:**
- `components/settings/settings-content.tsx` orchestrates tabs via `SettingsLayout`:
  - **account** — `AccountTab` (email/password/sign-out)
  - **preferences** — `PreferencesTab`
  - **usage** — usage meters (derived from `DAILY_LIMITS`) + free-tier summary
  - **billing** — informational only; paid tiers are not yet available (see Upgrade CTAs → waitlist)
  - **danger-zone** — account deletion via `mailto:support@grimoire.pro` (no in-app self-service delete; see cascade below)
- Shared primitives in `components/settings/settings-primitives.tsx`, layout in `settings-layout.tsx`

### 13. Waitlist (Upgrade CTAs)

- The five "Upgrade to Pro" CTAs (`world-settings-drawer.tsx`, `user-nav.tsx`, `rate-limit-modal.tsx`, `tavern-chat.tsx` ×2) open a `WaitlistDialog` email-capture instead of a billing page.
- POST `/api/waitlist` — Zod-validated `{ email, source? }`, 400 on invalid email, idempotent upsert on the `email` unique constraint. Insert-only RLS `waitlist` table (migration `20260624000100_waitlist.sql`).

### 14. Global Command Palette (Cmd+K)

- `components/shared/command-palette.tsx` (cmdk) — searches entities, souls (→ chat), lore entries (→ scribe). Mounted in `WorldWorkspace`.

### 15. Ambient Audio

- `components/shared/ambient-audio.tsx` — Web Audio API atmosphere; `useAmbientStore` (persisted). `AmbientToggle` in the world sidebar header.

### 16. Aether Background

- `components/aether/aether-background.tsx` — mouse-follow spotlight (CSS radial gradients via CSS vars), mounted in root layout.

---

## Navigation

### World Navigation Sections

Defined in `lib/constants.ts` as `WORLD_SECTIONS` (7 sections):

| Key | Label | Component |
|-----|-------|-----------|
| `lore` | Lore Scribe | `LoomEditor` |
| `bible` | The Archive | `ArchiveWorkspace` |
| `souls` | Bound Souls | `SoulCard` grid + `EchoesInterface` |
| `consistency` | Narrator's Eye | `FractureLens` |
| `tapestry` | The Tapestry | `TapestryTimeline` |
| `tavern` | The Tavern | `TavernChat` |
| `narrator` | Narrator's Tools | `NarratorTools` |

### Mobile Navigation (live)

Mobile navigation is rendered by **`components/layout/world-sidebar.tsx`**, NOT by any
AetherDock. The mobile bar shows the **first five sections directly** plus a **"More"**
button. Tapping "More" opens a bottom sheet (backdrop + `AnimatePresence` sheet, theme
tokens) listing the remaining sections (`items.slice(5)` → Tavern, Narrator's Tools), so
**all seven sections are reachable on mobile**. The old `components/aether/aether-dock.tsx`
has been removed.

---

## Rate Limits

All per-user, per-day (reset midnight UTC), defined in `DAILY_LIMITS` (`lib/constants.ts`):

| Action | Limit |
|--------|-------|
| Chat messages | 5/day |
| Lore ingest | 10/day |
| Autocomplete | 30/day |
| Consistency checks | 5/day |
| Soul generate | 3/day |
| Tavern messages | 30/day |
| Narrator actions | 20/day |

Enforced via `checkAndIncrement()` (`lib/rate-limit.ts`), which **fails closed** (rejects
when the limiter RPC errors). The public demo chat (`/api/demo/chat`) is unauthenticated,
so it uses IP-based throttling + a global daily circuit breaker from `lib/rate-limit-ip.ts`
instead of per-user metering.

**Key copy:** "The spellwork needs to rest.", "Today's Ink" (usage meter label)

## Free Tier Limits

| Resource | Limit |
|----------|-------|
| Worlds | 1 |
| Souls per world | 3 |
| Lore entries per world | 50 |
| Tavern souls per session | 3 (Pro: 4) |

---

## Design System

### Colors (Warm Sepia Dark Fantasy)

Dark mode (`.dark` class) — actual CSS values in `app/globals.css`:

| Token | CSS var | Dark hex | Usage |
|-------|---------|----------|-------|
| background | `--bg` | `#0A0A0B` | Page background |
| surface | `--surface` | `#121214` | Card surfaces |
| surface-raised | `--surface-raised` | `#1C1C1F` | Elevated panels |
| foreground | `--text-main` | `#F4F4F5` | Body text |
| muted | `--text-muted` | `#A1A1AA` | Secondary text |
| border | `--border` | `#27272A` | All borders |
| border-focus | `--border-focus` | `#52525B` | Focus rings |
| accent | `--accent` | `#E5A85A` | Gold |
| accent-soft | `--accent-soft` | `#F0C07A` | Soft gold |
| ai-pulse | `--ai-pulse` | `#5E81AC` | Arcane blue |
| danger | `--danger` | `#E05555` | Error |
| success | `--success` | `#4FA882` | Success |

### Light Theme — "Illuminated Manuscript"

The light theme (`:root`) uses warm parchment/ink tokens (NOT cold alabaster): e.g.
`--bg: #F5F0E8` (aged vellum), `--text-main: #1C1410` (iron gall ink),
`--accent: #8B4513` (saddle brown), `--ai-pulse: #3D5A7A` (woad blue).

### Theme Discipline & CSS Variables

- Grimoire natively supports **Dark Parchment** (default) and **Light Mode**.
- **Never hardcode hex values, `text-white`, or `bg-black` in components.** Always use the
  semantic tokens (`--text-main`, `--bg`, `--surface`, `--border`, etc.). For translucent
  surfaces and scrims use the established `color-mix(in srgb, var(--bg) 60%, transparent)`
  pattern rather than `bg-black/60`.
- Global theme transitions take 0.45s using `--ease-drawer`.

### Interaction & Animation (Design Engineering)

Grimoire follows "Emil Kowalski" design-engineering principles:
1. **Never animate layout:** only transition `transform`, `opacity`, `background-color`, `border-color`, `box-shadow`.
2. **Tactile feedback:** `active:scale-[0.97] active:transition-none` on interactive elements.
3. **Custom easing:** `--ease-snap`, `--ease-strong-out`, `--ease-drawer` (no linear edges).

### Typography

- **Headings:** `font-heading` → `var(--font-crimson)` (Crimson Pro serif)
- **Body:** `font-sans` → `var(--font-inter)` (Inter)

---

## Architecture

### Request flow (metered, monitored route)

`middleware` (security headers, `/api/eval/*` dev-gate) → `withErrorMonitoring` (Sentry
context) → `requireUser` → `requireWorldAccess(role)` → Zod parse → domain work →
JSON response. Any throw is caught by `withErrorMonitoring`, reported to Sentry, and
returned as a safe 500.

### Data Flow — Lore Ingest (Primary: Inngest)

```
User writes lore
  → POST /api/lore/ingest
    → Save lore_entry (processing_status: "pending")
    → inngest.send("lore.inscribed", { worldId, entryId, content, userId })
  → Client polls GET /api/lore/status?entryId= every 3s

Inngest worker (lib/inngest/lore-ingest.ts):
  Step 1: chunk-text → chunkLoreText(content)
  Step 2: extract-entities → extractEntities(content) via Groq, Zod-validated
  Step 3: embed-chunks → embedText() per chunk (HuggingFace), bounded backoff
  Step 4: save-to-db → insert lore_chunks, upsert entities, mark "complete"
onFailure: → insert failed_jobs record, mark entry "failed"
```

### Data Flow — Soul Chat (with Semantic Cache)

```
User sends message
  → POST /api/souls/chat
    → Embed prompt (HuggingFace all-mpnet-base-v2 — embeddings only)
    → Query semantic_cache (match_semantic_cache RPC, threshold 0.98)
    → Cache HIT: return cached response (instant, increment hit_count)
    → Cache MISS: Groq llama-3.1-8b-instant streams; cached post-stream
```

### Inngest Setup

- Client: `lib/inngest-client.ts` — `new Inngest({ id: "grimoire" })`
- Function: `lib/inngest/lore-ingest.ts` — `loreIngestFunction`
- Serve route: `app/api/inngest/route.ts`
- Local dev: `npx inngest-cli@latest dev` (port 8288)

### Monitoring

- **Sentry:** `instrumentation.ts` `register()` loads `sentry.server.config.ts` /
  `sentry.edge.config.ts` by runtime; `onRequestError` is re-exported from
  `@sentry/nextjs`. `sentry.client.config.ts` runs in the browser. All three read
  `NEXT_PUBLIC_SENTRY_DSN` and are disabled when it is unset. `withErrorMonitoring`
  (`lib/sentry.ts`) wraps the highest-risk routes (`souls/chat`, `souls/generate`,
  `lore/ingest`, `consistency/check`, `narrator`, `tavern`, `entities/merge`,
  `worlds/[id]/export`).
- **PostHog:** `components/providers/posthog-provider.tsx` — cookieless
  (`persistence: "memory"`, `autocapture: false`), lazily initialized after hydration,
  identifies the user with their plan tier. No-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset.

### Key Library Files

| File | Purpose |
|------|---------|
| `lib/groq.ts` | Groq client; `getGroqClient()`, `groqGenerate()`, `groqStream()`, `GROQ_MODEL_HEAVY`, `GROQ_MODEL_FAST` |
| `lib/embedding/service.ts` | Hardened Embedding_Service (HuggingFace): `embedText()`, retry/backoff, dimension + input validation |
| `lib/embeddings.ts` | AI functions (extractEntities, checkConsistency, generateAutocomplete, analyzeImpact, detectBlankSpots, orderEventsChronologically, generateTavernResponse, detectDeclarativeFact) — all via Groq |
| `lib/env.ts` | Server env accessors + `getEmbeddingConfig()` / `isFallbackConfigured()` |
| `lib/public-env.ts` | Browser-safe Supabase env accessors |
| `lib/world-access.ts` | `requireWorldAccess()` role gating (owner/editor/viewer) |
| `lib/rate-limit.ts` | `checkAndIncrement()` — per-user per-day metering (fails closed) |
| `lib/rate-limit-ip.ts` | `checkIpRateLimit()` + `checkGlobalDailyCap()` for public demo chat |
| `lib/constants.ts` | `DAILY_LIMITS`, `FREE_TIER_LIMITS`, `WORLD_SECTIONS`, thresholds |
| `lib/sentry.ts` | `withErrorMonitoring()` route wrapper |
| `lib/onboarding-steps.ts` | Onboarding step defs + `OnboardingState` |
| `lib/stores/focus-mode-store.ts` | Immersive-writing preferences (persisted, validated) |
| `lib/api.ts` | `requireUser()`, `jsonError()`, `jsonRateLimited()`, `zodErrorResponse()` |

### Supabase Schema (highlights)

Core: `profiles`, `worlds`, `lore_entries`, `lore_chunks`, `entities`, `souls`,
`conversations`, `messages`, `consistency_checks`, `consistency_flags`, `rate_limits`.
Expansion: `failed_jobs`, `semantic_cache`, `lore_folders`, `entity_relationships`,
`tavern_sessions`, `tavern_messages`. Collaboration: `world_members`, `world_invitations`.
Waitlist: `waitlist`. `profiles.onboarding_state` (JSONB) stores onboarding progress.

**RPCs:** `match_lore_chunks`, `match_semantic_cache`, `replace_entity_tag`,
`increment_entity_mentions`, batch entity upsert, atomic rate-limit, dashboard stats.

All tables enforce RLS; world children are owned via `worlds.user_id` and shared via
`world_members`.

---

## Environment Variables

See `.env.example` for the authoritative, commented list. Summary:

```env
# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL (browser-safe)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key (browser-safe)
SUPABASE_SERVICE_ROLE_KEY=         # server-only; bypasses RLS (Inngest worker, eval webhook)

# ── Generation (Groq) ──
GROQ_API_KEY=                      # required for all LLM generation

# ── Embeddings (HuggingFace) ──
HF_TOKEN=                          # optional but recommended (removes anon rate limits)
EMBEDDING_FALLBACK_TOKEN=          # optional fallback provider token
EMBEDDING_FALLBACK_MODEL=          # optional fallback model id

# ── Inngest ──
INNGEST_EVENT_KEY=                 # "test" for local dev; real key for production
INNGEST_SIGNING_KEY=               # "test" for local dev

# ── Monitoring ──
NEXT_PUBLIC_SENTRY_DSN=            # optional; Sentry disabled when unset
NEXT_PUBLIC_POSTHOG_KEY=           # optional; PostHog no-ops when unset
NEXT_PUBLIC_POSTHOG_HOST=          # optional; defaults to https://us.i.posthog.com

# ── Eval (dev-only) ──
EVAL_WEBHOOK_SECRET=               # required for the eval webhook to accept writes
```

There is **no** `GEMINI_API_KEY` and **no** Anthropic key — do not add them.

---

## Account Deletion Cascade (manual, GDPR path)

There is no in-app self-service account deletion. Users email `support@grimoire.pro`
(surfaced in Settings → Danger Zone). Deletion is performed manually in Supabase and
relies on `ON DELETE CASCADE` foreign keys. The two **root records** are `profiles` and
`worlds`:

- `profiles.id` references `auth.users(id)`; `worlds.user_id` references
  `profiles(id) ON DELETE CASCADE`.
- Every world child references `worlds(id) ON DELETE CASCADE`: `lore_entries`,
  `lore_chunks`, `entities`, `souls`, `consistency_checks`, `consistency_flags`,
  `world_members`, `world_invitations` (and, transitively, `conversations` → `messages`,
  which cascade from `souls`).

**Manual steps in Supabase:**

1. Look up the user's `id` in `auth.users` (by email).
2. Delete the user's rows in `worlds` (`delete from worlds where user_id = '<id>'`). This
   cascades to all world children (lore, chunks, entities, souls, conversations, messages,
   consistency data, members, invitations).
3. Delete the user's `profiles` row (`delete from profiles where id = '<id>'`).
4. Delete the user from `auth.users` (Supabase Auth → Users, or the admin API). Deleting
   the auth user also cascades to `profiles` (which in turn cascades to `worlds`), so
   step 4 alone removes everything; steps 2–3 are explicit for clarity/verification.
5. Optionally remove the address from `waitlist` if present.

---

## Dev Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest (vitest run)
npm run build        # Production build (must pass with 0 errors)
npx inngest-cli@latest dev   # Inngest dev server (http://localhost:8288)
```
