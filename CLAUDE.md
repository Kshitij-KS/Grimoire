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
| Database | Supabase PostgreSQL + pgvector (768-dim embeddings) |
| AI — Generation | Groq (`llama-3.3-70b-versatile` for heavy tasks, `llama-3.1-8b-instant` for fast/streaming) |
| AI — Embeddings | Google Gemini (`gemini-embedding-2-preview`, 768-dim) — embeddings ONLY |
| Background Jobs | Inngest (multi-step functions, retry/backoff, dead-letter queue) |
| Rich Text | TipTap (StarterKit + CharacterCount + Placeholder) |
| State | Zustand (`useWorkspaceStore`, `useDraftStore`, `useAmbientStore`) |
| Forms | React Hook Form + Zod |
| Command Palette | cmdk |
| Notifications | Sonner |

**Important:** Groq is the primary AI inference engine for all text generation tasks. Gemini is retained **only** for vector embeddings (`gemini-embedding-2-preview`). Both `GROQ_API_KEY` and `GEMINI_API_KEY` are required. The `@anthropic-ai/sdk` package is present in `package.json` but is not used by any current feature — do not introduce Anthropic calls.

---

## Features

### 1. Lore Scribe — The Enchanted Editor

**What it does:** A rich text editor where writers pour their world's lore. When submitted, the text is sent to Inngest for background processing (chunked, embedded into pgvector, entities extracted). Falls back to synchronous SSE if Inngest is unavailable.

**Implementation:**
- TipTap editor with heading/bold/italic/blockquote/list support
- Title + content saved as a `lore_entries` record with `processing_status` field
- **Primary path:** POST `/api/lore/ingest` → sends `lore.inscribed` event to Inngest → returns `{ entry, processing: "background", eventId }`
- **Fallback path:** SSE stream if Inngest unavailable: `saved → chunking → embedding_progress → embedding_complete → entity_extraction → complete`
- Processing status polled via GET `/api/lore/status?entryId=` for background jobs
- Lore entry CRUD: PATCH/DELETE `/api/lore/[id]`
- Lore entries can be organized into **folders** (CRUD via `/api/lore/folders`)
- Semantic search: POST `/api/lore/search` — embedding similarity via `match_lore_chunks` RPC
- **Oracle's Whisper:** POST `/api/lore/autocomplete` — AI writing continuation suggestions
- Ctrl+S / Cmd+S keyboard shortcut to inscribe
- **Offline auto-save:** `useDraftStore` (Zustand, persisted to localStorage) saves draft every 30s; discards drafts older than 24h

**Rate limit:** 10 lore ingest per day
**Free tier cap:** 50 lore entries per world

**Key copy:** "Inscribe & Remember" (button), "Inscribing..." (loading)

---

### 2. The Archive (World Bible) — Entity Memory

**What it does:** Automatically extracts and organizes entities from lore into a browsable archive with four view modes: Constellation, Codex, Web, and Scroll.

**Implementation:**
- Entities in `entities` table: type, name, summary, mention_count, entity_tags
- `ArchiveWorkspace` — top-level orchestrator with 4 view modes + Oracle reveal + PNG export
- `ConstellationCanvas` — interactive canvas (zoom/pan, type-specific shapes, search overlay, type filter chips, theme-aware colors via `resolveThemeColors()`)
- `ConstellationDossier` — side panel: navigation history breadcrumbs, inline name edit, expandable lore fragments, "Forge Soul" CTA, soul-bound check
- `ArchiveCodex` — enhanced entity grid with type sidebar, sort controls, ink-drop mention counts, relationship badges
- `ArchiveWeb` — SVG force-directed relationship visualization (custom `useForceLayout` hook, no external library)
- `ArchiveScroll` — compendium reading mode (scrollable articles with expandable lore fragments)
- Entity CRUD: DELETE/PATCH `/api/entities/[id]` — uses `entityPatchSchema` from `lib/entity-validation.ts`
- Entity relationships stored in `entity_relationships` table via POST `/api/relationships`
- **Incremental Refresh**: GET `/api/entities?worldId=<id>&since=<ISO>` — hidden on demo worlds

**Entity types:** character, location, faction, artifact, event, rule

**Archive view modes:** `"constellation" | "codex" | "web" | "scroll"` — state owned by `ArchiveWorkspace`, transitions use `AnimatePresence mode="wait"` + opacity/blur over 200ms.

---

### 3. Bound Souls — Character AI Personas

**What it does:** Forge characters into AI personas with voice, memory, secrets, and knowledge shaped by the lore. Chat with them directly.

**Soul Card structure (JSONB):**
- `voice`, `core`, `knows` (5-8), `doesnt_know` (3-5), `relationships` (3-5), `secrets` (2-3), `sample_lines` (exactly 3)

**Implementation:**
- POST `/api/souls/generate` — Groq `llama-3.3-70b-versatile`, Zod-validated via `lib/soul-card.ts` + `repairAndParseJSON`. Two-attempt fallback strategy (system+user split → combined prompt).
- POST `/api/souls/chat` — **semantic cache layer** (pgvector similarity on recent prompts, threshold 0.98); cached responses served instantly; cache misses stream via Groq `llama-3.1-8b-instant` and are cached post-stream
- Soul-specific chat: DELETE `/api/souls/[id]/chat` — clear conversation history
- Manual overrides: PATCH `/api/souls/[id]` — edits `description`, `voice`, `core` fields without regeneration
- Soul delete: DELETE `/api/souls/[id]`
- Source attribution: `source_chunk_ids` stored on messages for traceable lore references
- Memory imprinting: `detectDeclarativeFact()` detects user statements → stored as persistent facts
- `SoulCardPanel` component — renders soul card details, manual override inputs, regenerate button
- `EchoesOrb` and `EchoesOrbDynamic` — animated orb avatar for soul chat

**Rate limits:** 3 soul generate/day, 5 chat messages/day

---

### 4. The Tapestry — Chronological Timeline

**What it does:** AI-ordered timeline of all world events. The Oracle reads lore entries and arranges events in chronological order grouped by inferred era.

**Implementation:**
- POST `/api/narrator` with `action: "timeline"` → `orderEventsChronologically()` (Groq `llama-3.3-70b-versatile`)
- Events grouped into eras (Early Age, Rise of Empires, etc.)
- Visual vertical timeline with era dividers and animated event cards
- Built-in `isDemo` mock data bypass for public demos without requiring backend auth.
- Component: `components/tapestry/tapestry-timeline.tsx`

---

### 5. The Tavern — Multi-Soul Chat

**What it does:** Gather 2-4 souls in a shared scene. Direct the conversation or address specific souls; they respond in voice, reacting to each other and the world's lore.

**Implementation:**
- Sessions stored in `tavern_sessions` table; messages in `tavern_messages`
- GET `/api/tavern?worldId=` — list sessions; GET `/api/tavern?sessionId=` — fetch messages
- POST `/api/tavern` with `action: "create"` — create session with `{ worldId, soulIds, name? }`
- POST `/api/tavern` — `{ sessionId, worldId, message, directedToSoulId? }` → `generateTavernResponse()`
- **Strict JSON-based contract & per-soul prompt isolation:** To mitigate hallucination and persona blending, 2 souls use a single Duo call with enforced turn order. 3+ souls use parallel isolated generation where each soul only sees its own card. The internal reasoning step is discarded from the final output.
- **Daily limit:** 30 tavern messages/day (set via `DAILY_LIMITS.tavern_message` in `lib/constants.ts`)
- **Session limit:** Free tier limited to 3 souls per session (Pro up to 4).
- Component: `components/tavern/tavern-chat.tsx`

---

### 6. The Narrator's Eye — Consistency Radar

**What it does:** Paste new writing; the archive checks it against established lore for contradictions.

**Implementation:**
- POST `/api/consistency/check` — dual retrieval (embedding similarity + entity-tag overlap), Groq `llama-3.3-70b-versatile` contradiction analysis
- Returns `ConsistencyFlag[]` with severity (low/medium/high)
- Flags stored in `consistency_flags`, resolvable via POST `/api/consistency/resolve`
- Unresolve (undo) via POST `/api/consistency/unresolve`
- `partitionConsistencyFlags()` and `toggleConsistencyFlagResolved()` in `lib/consistency-flags.ts`
- `FractureLens` component — main UI. `ConsistencyChecker` component — overlapping/legacy path (to be consolidated)
- `FlagCard` component — individual flag display with resolve/unresolve toggle

**Rate limit:** 5 checks/day

---

### 7. Narrator's Tools — What-If & Lore Holes

**What it does:** Two AI-powered analysis tools:
1. **Impact Simulator:** "What if X happened?" → analyses affected entities, orphaned characters, invalidated world rules
2. **Blank Spot Detection:** Finds under-developed entities and suggests what's missing

**Implementation:**
- POST `/api/narrator`:
  - `action: "impact"` → `analyzeImpact(scenario, loreContext)` → `{ affected?, orphaned?, invalidated? }` (all fields optional — AI may return partial)
  - `action: "blank-spots"` → `detectBlankSpots(entities, loreContext)` → `{ holes: BlankSpot[] }`
  - `action: "timeline"` → `orderEventsChronologically(events)` → `{ timeline: [] }`
- **All `ImpactResult` fields are optional** — always use optional chaining (`?.`) when accessing `affected`, `orphaned`, `invalidated`
- Built-in `isDemo` mock data bypass for public demos.
- Component: `components/narrator/narrator-tools.tsx`

---

### 8. Dashboard — Overview Center

**What it does:** Landing page after login showing all worlds, global stats, and recent activity feed.

**Implementation:**
- Server component: `app/dashboard/page.tsx` — parallel Supabase queries for worlds, counts, recent activity
- Client data fetched via GET `/api/dashboard`
- `DashboardOverview` client component with animated world cards, stat counters, scrollable activity feed
- `WorldCard` component (`components/dashboard/world-card.tsx`) — individual world card
- Activity types: `lore_created`, `soul_forged`, `consistency_check`, `chat_message`, `entity_discovered`
- World cards link directly to each world workspace

---

### 9. Account Settings

**What it does:** User account management page at `/dashboard/settings`.

**Implementation:**
- `app/dashboard/settings/page.tsx` — settings route
- `AccountSettingsPanel` component (`components/dashboard/account-settings-panel.tsx`) — email update, password update, sign-out
- Billing section exists in UI but real checkout is blocked (no Stripe integration)
- Account deletion is blocked pending audited cascade strategy

---

### 10. Global Command Palette (Cmd+K)

**What it does:** Keyboard-first navigation across entities, souls, and lore entries. Supports direct soul chat shortcuts.

**Implementation:**
- `components/shared/command-palette.tsx` — powered by `cmdk`
- Triggered by Cmd+K / Ctrl+K anywhere in the world workspace
- Searches: entities (with type icons), bound souls (→ route to chat), lore entries (→ route to scribe)
- Mounted inside `WorldWorkspace` — receives live `entities` state (not stale initial prop)

---

### 11. Ambient Audio

**What it does:** Optional dark fantasy atmosphere — subtle low-frequency synth pads and crackling noise, generated with Web Audio API (no external audio files).

**Implementation:**
- `components/shared/ambient-audio.tsx`
- `AmbientAudioProvider` — mounted in root `layout.tsx`, persists across routes
- `useAmbientStore` (Zustand, persisted to localStorage) — tracks `enabled` + `volume`
- `AmbientToggle` button — shown in world sidebar header
- Uses oscillators (55Hz, 82.5Hz, 110Hz) + bandpass-filtered noise buffer

---

### 12. Aether Background & Mobile Dock

**What it does:**
- `AetherBackground` — mouse-follow spotlight effect layered behind all content
- `AetherDock` — bottom mobile navigation bar (shown only on mobile/tablet via `lg:hidden`)

**Implementation:**
- `components/aether/aether-background.tsx` — sets `--mouse-x` / `--mouse-y` CSS vars on `document.documentElement` via passive mousemove/touchmove listeners. Renders two radial gradient layers (no canvas, pure CSS).
- `components/aether/aether-dock.tsx` — bottom dock; shows **only 4 sections** (lore, bible, souls, consistency). The remaining sections (tapestry, tavern, narrator) are accessible via the sidebar. Uses `layoutId="moonlit-dock"` spring animation for active indicator.
- Both mounted in root `app/layout.tsx`.

---

## Rate Limits

All per-user, per-day (reset midnight UTC):

| Action | Limit |
|--------|-------|
| Chat messages | 5/day |
| Lore ingest | 10/day |
| Consistency checks | 5/day |
| Soul generate | 3/day |
| Tavern messages | 30/day |
| Narrator actions | 20/day |

**Key copy:** "The spellwork needs to rest.", "Today's Ink" (usage meter label)

---

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

The light theme (`:root`) uses warm parchment/ink tokens (NOT cold alabaster):

| Token | Value | Description |
|-------|-------|-------------|
| `--bg` | `#F5F0E8` | Aged vellum parchment |
| `--surface` | `#FAF7F2` | Lighter vellum (card surfaces) |
| `--surface-raised` | `#F0EBE0` | Manuscript board (elevated panels) |
| `--text-main` | `#1C1410` | Iron gall ink (warm near-black) |
| `--text-muted` | `#6B5E4E` | Faded sepia (warm, never cold gray) |
| `--border` | `#DDD4C4` | Aged paper crease |
| `--accent` | `#8B4513` | Saddle brown (ink and leather) |
| `--ai-pulse` | `#3D5A7A` | Woad blue / monastic lapis lazuli |
| `--danger` | `#8B2020` | Crimson wax seal |

Also adds warm body gradient (`:root` block), warm `.bg-grid` ruling lines, and `::selection` at 28% accent tint.

### Typography

- **Headings:** `font-heading` → maps to `var(--font-crimson)` (Crimson Pro serif, loaded in `app/layout.tsx`)
- **Body:** `font-sans` → maps to `var(--font-inter)` (Inter, loaded in `app/layout.tsx`)
- **Chapter labels:** "— Section Title —" with dashes, small caps

### Interaction & Animation (Design Engineering)

Grimoire strictly follows "Emil Kowalski" design engineering principles:
1. **Never animate layout:** Only transition `transform`, `opacity`, `background-color`, `border-color`, and `box-shadow`.
2. **Tactile Feedback:** Apply `active:scale-[0.97] active:transition-none` to all interactive buttons and cards to mimic physical weight.
3. **Custom Easing:** Never use default linear edges. Use defined custom CSS variables:
   - `--ease-snap`: Intended for snappy spring-like menus (`cubic-bezier(0.23, 1, 0.32, 1)`)
   - `--ease-strong-out`: Large distance reveals (`cubic-bezier(0.22, 1, 0.36, 1)`)
   - `--ease-drawer`: Smooth, elegant sweeps like global theme transitions (`cubic-bezier(0.32, 0.72, 0, 1)`)

### Theme Toggle & CSS Variables

- Grimoire natively supports both **Dark Parchment** (default) and **Light Mode**.
- **Never hardcode hex values or `text-white`/`bg-black` in components.** Always use semantic `--text-main`, `--bg`, `--surface`, or `--border` to ensure contrast in both themes.
- Global theme transitions are smoothed dynamically in `globals.css` taking 0.45s using `--ease-drawer` rather than instantly flashing.

### Tailwind Color Tokens

The tailwind config maps semantic names to CSS vars. Key mappings:
- `background` → `var(--bg)`
- `foreground` → `var(--text-main)`
- `primary` → `var(--text-main)` (NOT arcane purple — use `ai-pulse` for that)
- `accent` → `var(--accent)` (gold/brown)
- `ai-pulse` → `var(--ai-pulse)` (arcane blue)
- `surface` / `surface-raised` → elevated panel tokens
- `border` / `border-focus` → border tokens

### Decorative Classes

| Class | Usage |
|-------|-------|
| `.glass-panel` | Standard glassmorphism surface |
| `.glass-panel-elevated` | Elevated surface |
| `.arcane-border` | Gradient border (purple → gold) |
| `.chapter-label` | "— Title —" section label style |
| `.gold-shimmer` | Animated gold gradient text |
| `.rune-float` | `glyphRotate 12s` rotating decorative runes |
| `.soul-glow-ring` | `soulAwaken 4s` perpetual soul avatar glow |

---

## Architecture

### World Navigation Sections

Defined in `lib/constants.ts` as `WORLD_SECTIONS`:

| Key | Label | Component |
|-----|-------|-----------|
| `lore` | Lore Scribe | `LoomEditor` |
| `bible` | The Archive | `ArchiveWorkspace` (orchestrates Constellation/Codex/Web/Scroll views) |
| `souls` | Bound Souls | `SoulCard` grid + `EchoesInterface` |
| `consistency` | Narrator's Eye | `FractureLens` |
| `tapestry` | The Tapestry | `TapestryTimeline` |
| `tavern` | The Tavern | `TavernChat` |
| `narrator` | Narrator's Tools | `NarratorTools` |

**Mobile note:** `AetherDock` (bottom mobile nav) only exposes the first 4 sections. The remaining 3 (tapestry, tavern, narrator) require the sidebar on mobile.

### Data Flow — Lore Ingest (Primary: Inngest)

```
User writes lore
  → POST /api/lore/ingest
    → Save lore_entry (processing_status: "pending")
    → inngest.send("lore.inscribed", { worldId, entryId, content, userId })
    → Return { entry, processing: "background", eventId }
  → Client polls GET /api/lore/status?entryId= every 3s

Inngest worker (lib/inngest/lore-ingest.ts):
  Step 1: chunk-text → chunkLoreText(content)
  Step 2: extract-entities → extractEntities(content) with Zod validation
  Step 3: embed-chunks → embedText() per chunk, exponential backoff (1s/2s/4s)
  Step 4: save-to-db → insert lore_chunks, upsert entities, mark "complete"

onFailure: → insert failed_jobs record, mark entry "failed"
```

### Data Flow — Soul Chat (with Semantic Cache)

```
User sends message
  → POST /api/souls/chat
    → Embed prompt (Gemini gemini-embedding-2-preview — embeddings only)
    → Query semantic_cache (match_semantic_cache RPC, threshold 0.98)
    → Cache HIT: return cached response (instant, increment hit_count)
    → Cache MISS:
      → Fetch soul card + conversation history + lore_chunks
      → Groq llama-3.1-8b-instant streams response (800+ tps)
      → Post-stream: store in semantic_cache for future hits
      → Store message with source_chunk_ids
      → detectDeclarativeFact() → store as memory if applicable
```

### Inngest Setup

- Client: `lib/inngest-client.ts` — `new Inngest({ id: "grimoire" })`
- Function: `lib/inngest/lore-ingest.ts` — `loreIngestFunction`
- Serve route: `app/api/inngest/route.ts` — `serve({ client: inngest, functions: [loreIngestFunction] })`
- Local dev: `npx inngest-cli@latest dev` (runs on port 8288)
- The function uses `triggers: [{ event: "lore.inscribed" }]` in the config object (2-argument form of `createFunction`)

### Key Files

| File | Purpose |
|------|---------|
| `app/globals.css` | CSS variables, design tokens, keyframes |
| `lib/types.ts` | All TypeScript types + new interfaces (FailedJob, SemanticCacheEntry, LoreFolder, EntityRelationship, TavernSession, TavernMessage, DashboardData, ActivityItem) |
| `lib/constants.ts` | DAILY_LIMITS (`chat_message: 5`), FREE_TIER_LIMITS, WORLD_SECTIONS (7 sections), SEMANTIC_CACHE_THRESHOLD (0.98), CHUNK_SIZE_WORDS (400), AUTOCOMPLETE_WORD_COUNT (15) |
| `lib/gemini.ts` | Gemini client — **embeddings only**; `getEmbeddingModel()` → `gemini-embedding-2-preview`. `getGeminiModel()` and `getChatModel()` removed (replaced by Groq). |
| `lib/groq.ts` | Groq client singleton; `getGroqClient()`, `groqGenerate()` (non-streaming), `groqStream()` (streaming), `GROQ_MODEL_HEAVY` (`llama-3.3-70b-versatile`), `GROQ_MODEL_FAST` (`llama-3.1-8b-instant`) |
| `lib/embeddings.ts` | All AI functions (embedText via Gemini, extractEntities via Groq, checkConsistency via Groq, generateAutocomplete via Groq, analyzeImpact via Groq, detectBlankSpots via Groq, orderEventsChronologically via Groq, generateTavernResponse via Groq, detectDeclarativeFact via Groq) + Zod validation |
| `lib/json-repair.ts` | Robust JSON parsing for malformed AI outputs — `repairAndParseJSON<T>()` and `safeParseAIJSON<T>()` |
| `lib/soul-card.ts` | Soul card Zod schema + prompt + `parseSoulCard()` (uses `repairAndParseJSON` internally) |
| `lib/soul-access.ts` | `soulMatchesWorld(soulWorldId, requestWorldId)` — soul/world ownership guard |
| `lib/entity-validation.ts` | `entityPatchSchema` (Zod) + `entityTypeValues` — used by PATCH `/api/entities/[id]` |
| `lib/consistency-flags.ts` | `partitionConsistencyFlags()`, `toggleConsistencyFlagResolved()` — pure helpers |
| `lib/store.ts` | Zustand: `useWorkspaceStore` (section/modals/entity/soul), `useDraftStore` (offline auto-save) |
| `lib/inngest-client.ts` | Inngest SDK singleton |
| `lib/inngest/lore-ingest.ts` | Multi-step lore background function |
| `lib/chunker.ts` | Text chunking (~400 words + sentence overlap) |
| `lib/data.ts` | Server-side fetching; `getWorldWorkspaceData` returns `folders: []` and `relationships: []` |
| `lib/mock-data.ts` | Demo world "Ashveil" data |
| `lib/rate-limit.ts` | `checkAndIncrement()` — per-user per-day rate limiting |
| `lib/env.ts` | Env var accessors — MUST use dot notation |
| `lib/api.ts` | `requireUser()`, `jsonError()`, `jsonRateLimited()`, `zodErrorResponse()` — shared API helpers |
| `lib/utils.ts` | `cn()`, `initialsFromName()`, `formatRelativeTime()`, etc. |
| `app/layout.tsx` | Root layout — mounts `ThemeProvider`, `AetherBackground`, `AmbientAudioProvider`, `AppProviders` |
| `app/api/entities/route.ts` | GET `/api/entities?worldId=&since=<ISO>` — incremental entity fetch for archive refresh |
| `app/api/entities/[id]/route.ts` | DELETE/PATCH `/api/entities/[id]` — entity management |
| `app/api/souls/[id]/route.ts` | DELETE/PATCH `/api/souls/[id]` — soul management + manual card overrides |
| `app/api/souls/[id]/chat/route.ts` | DELETE chat history for soul by URL param |
| `app/api/worlds/[id]/export/route.ts` | GET — full world JSON export (lore, entities, souls, consistency, tavern, chat history) |
| `app/api/jobs/route.ts` | Failed jobs endpoint |
| `app/api/consistency/unresolve/route.ts` | POST — undo flag resolution |
| `components/worlds/world-workspace.tsx` | Main workspace; renders all 7 sections + CommandPalette + archive refresh logic |
| `components/layout/world-sidebar.tsx` | 7-section nav + AmbientToggle; mobile shows first 5 |
| `components/layout/world-right-panel.tsx` | Right panel for entity/soul detail |
| `components/layout/world-settings-drawer.tsx` | World settings drawer |
| `components/aether/aether-background.tsx` | Mouse-follow spotlight (CSS radial gradient via CSS vars) — mounted in root layout |
| `components/aether/aether-dock.tsx` | Mobile bottom nav (4 sections: lore, bible, souls, consistency) |
| `components/bible/archive-workspace.tsx` | Archive view-mode orchestrator; owns `viewMode` state, Oracle reveal, PNG export, refresh button |
| `components/bible/archive-codex.tsx` | Codex view — enhanced entity grid with type sidebar, sort, search, ink-drop mention counts |
| `components/bible/archive-web.tsx` | Web view — SVG force-directed relationship graph (custom `useForceLayout`, no library) |
| `components/bible/archive-scroll.tsx` | Scroll view — compendium reading mode, expandable lore fragments, type filter bar |
| `components/bible/entity-grid.tsx` | Shared entity grid component |
| `components/bible/entity-card.tsx` | Individual entity card |
| `components/bible/entity-detail-panel.tsx` | Entity detail panel |
| `components/bible/forge-relationship-modal.tsx` | Create relationship modal |
| `components/souls/soul-card.tsx` | Soul card list item |
| `components/souls/soul-card-panel.tsx` | Full soul card panel with manual override inputs and regenerate |
| `components/souls/soul-chat-interface.tsx` | Soul chat interface |
| `components/souls/soul-creation-modal.tsx` | Forge soul modal |
| `components/echoes/echoes-interface.tsx` | Full soul chat experience |
| `components/echoes/echoes-orb.tsx` | Static orb avatar |
| `components/echoes/echoes-orb-dynamic.tsx` | Animated orb avatar |
| `components/consistency/fracture-lens.tsx` | Consistency checker main UI |
| `components/consistency/flag-card.tsx` | Individual consistency flag card |
| `components/consistency/consistency-checker.tsx` | Legacy/overlapping consistency UI — to be consolidated with FractureLens |
| `components/lore/loom-editor.tsx` | Primary TipTap lore editor |
| `components/lore/lore-editor.tsx` | Legacy/alternate lore editor |
| `components/lore/lore-list.tsx` | Lore entry list |
| `components/lore/processing-status.tsx` | Processing status indicator |
| `components/dashboard/dashboard-overview.tsx` | Dashboard stats + world cards + activity feed |
| `components/dashboard/world-card.tsx` | World card component |
| `components/dashboard/account-settings-panel.tsx` | Account settings: email/password update, sign-out |
| `components/landing/landing-page.tsx` | Full landing page |
| `components/landing/social-proof-strip.tsx` | Landing page social proof strip (3 animated count-up stat badges) |
| `components/landing/soul-chat-preview.tsx` | Landing page soul chat preview demo |
| `components/shared/command-palette.tsx` | Cmd+K palette (cmdk) |
| `components/shared/ambient-audio.tsx` | Web Audio API ambient system + AmbientToggle + `useAmbientStore` |
| `components/shared/ambient-particles.tsx` | Ambient particle effect |
| `components/shared/loading-shimmer.tsx` | `LoadingShimmer` (legacy) + `SectionLoadingScreen` (themed arcane loading animation with orbiting runes) |
| `components/shared/destructive-action-modal.tsx` | Typed confirmation modal for destructive actions |
| `components/shared/empty-state.tsx` | Generic empty state component |
| `components/shared/grimoire-logo.tsx` | Logo component |
| `components/shared/breadcrumbs.tsx` | Breadcrumb navigation component |
| `components/shared/rate-limit-modal.tsx` | Rate limit exceeded modal |
| `components/shared/theme-toggle.tsx` | Theme toggle button |
| `components/tapestry/tapestry-timeline.tsx` | Chronological event timeline |
| `components/tavern/tavern-chat.tsx` | Multi-soul conversation UI |
| `components/narrator/narrator-tools.tsx` | Impact simulator + lore hole detection |
| `lib/hooks/use-count-up.ts` | Count-up animation hook (cubic-out easing, requestAnimationFrame) |
| `lib/hooks/use-scroll-y.ts` | Window scrollY hook (passive listener, used for landing page sticky header) |
| `supabase/migrations/` | All DB schema migrations |
| `tests/` | Vitest tests for consistency-flags, entity-validation, soul-access |

### Supabase Schema (17 Tables)

**Original 11:**
- `profiles`, `worlds`, `lore_entries` (+ `folder_id`, `processing_status`, `inngest_event_id`), `lore_chunks`, `entities` (unique on `world_id, normalized_name, type`), `souls`, `conversations` (unique on `user_id, soul_id`), `messages` (+ `source_chunk_ids`), `consistency_checks`, `consistency_flags`, `rate_limits`

**New 6 (feature expansion migration):**
- `failed_jobs` — Inngest dead-letter queue (status: failed/retrying/resolved)
- `semantic_cache` — pgvector cache for soul chat prompts (hit_count, prompt_embedding)
- `lore_folders` — hierarchical folder organization for lore entries
- `entity_relationships` — user-defined edges between entities (label, description)
- `tavern_sessions` — multi-soul chat sessions (soul_ids array)
- `tavern_messages` — individual tavern messages (role: user/director/soul, directed_to)

**RPCs:**
- `match_lore_chunks(world_uuid, query_embedding, match_count, filter_tags)` — pgvector similarity search
- `match_semantic_cache(query_embedding, soul_uuid, world_uuid, threshold)` — pgvector cache lookup

All tables have RLS enforcing `user_id` ownership.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key (browser-safe)
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key (server only — used by Inngest worker)
GEMINI_API_KEY=                 # Google Gemini API key (embeddings only — gemini-embedding-2-preview)
GEMINI_FALLBACK_API_KEY=        # Optional secondary Gemini API key for embedding fallover
GROQ_API_KEY=                   # Groq API key (primary generation engine — all LLM tasks)
INNGEST_SIGNING_KEY=            # Inngest signing key (use "test" for local dev)
INNGEST_EVENT_KEY=              # Inngest event key (use "test" for local dev; get real key from app.inngest.com for production)
```

---

## Dev Commands

```bash
npm run dev                    # Start Next.js dev server (http://localhost:3000)
npm run build                  # Production build (must pass with 0 errors)
npm run lint                   # ESLint check
npm test                       # Run Vitest tests
npx inngest-cli@latest dev     # Start Inngest dev server (http://localhost:8288) — required for background jobs
supabase start                 # Start local Supabase
supabase db reset              # Reset local DB and run all migrations
```

---

## The Crucible — LLM Benchmark Harness (Local Dev Only)

The benchmarking feature ("The Crucible") lets you run academic evaluation tasks (ARC, HellaSwag, MMLU, etc.) against Groq-hosted models and view results in a dashboard UI.

**⚠️ This feature is strictly local-development only.** The page returns 404 in production (`NODE_ENV !== "development"`). The Python sidecar is excluded from deployment via `.vercelignore` and `.gitignore`. Do not attempt to deploy the sidecar.

### Architecture Overview

```
Browser → Next.js (/api/eval/runs)
             ↓  HTTP + shared secret
        Python Sidecar (port 8001)
             ↓  lm_eval.simple_evaluate()
          Groq API (local-chat-completions)
             ↓  results via webhook
        Next.js (/api/eval/webhook)
             ↓
         Supabase (eval_runs table)
```

- **Python sidecar** (`scripts/eval-service/`): FastAPI app on port `8001`. Wraps `lm-evaluation-harness` to run benchmarks in a background thread against Groq's OpenAI-compatible API.
- **Next.js frontend**: Talks to the sidecar via a shared secret (`EVAL_SIDECAR_SECRET`). Receives results via a webhook (`/api/eval/webhook`) and persists them to the `eval_runs` Supabase table.
- **UI page**: `/dashboard/benchmarks` — only accessible when `NODE_ENV === "development"`.

### Step-by-Step: Running Benchmarks Locally

#### Step 1 — Prerequisites

- Python **3.9 or higher** must be installed. Verify with:
  ```bash
  python --version
  ```
- Your normal Next.js dev environment must be working (`npm run dev`).

#### Step 2 — One-time Setup (run once)

From the **project root**, run the setup script. This creates a Python virtual environment at `scripts/eval-service/.venv` and installs all dependencies:

```bash
npm run eval:setup
```

This script will also copy `scripts/eval-service/.env.example` → `scripts/eval-service/.env` if it doesn't already exist.

#### Step 3 — Configure the Sidecar `.env`

Open `scripts/eval-service/.env` and fill in your keys. The critical ones:

```env
GROQ_API_KEY=gsk_...            # Same key as in your root .env.local
SIDECAR_SECRET=change-me-in-production   # Must match EVAL_SIDECAR_SECRET in .env.local
WEBHOOK_SECRET=change-me-in-production   # Must match EVAL_WEBHOOK_SECRET in .env.local
NEXTJS_BASE_URL=http://localhost:3000    # Where the sidecar posts webhook results
```

Verify your root `.env.local` has matching values:

```env
EVAL_SIDECAR_SECRET=change-me-in-production
EVAL_WEBHOOK_SECRET=change-me-in-production
```

#### Step 4 — Start Both Servers (two terminal windows)

**Terminal 1 — Next.js:**
```bash
npm run dev
```
Next.js will be available at `http://localhost:3000`.

**Terminal 2 — Python sidecar:**
```bash
npm run eval:service
```
The sidecar will start at `http://localhost:8001`. You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     lm-eval sidecar starting up...
```

#### Step 5 — Access the Benchmark UI

Navigate to:
```
http://localhost:3000/dashboard/benchmarks
```

> **Note:** This URL returns a **404** unless `NODE_ENV=development`. It is never linked in the dashboard sidebar — it is only accessible by typing the URL directly. Log in first if you aren't already.

#### Step 6 — Run a Benchmark

1. In the UI, select a **model** (e.g., `llama-3.3-70b-versatile`) and one or more **tasks** (e.g., ARC Easy, HellaSwag).
2. Set the number of **samples** (5–500; lower = faster).
3. Click **Run Evaluation**.
4. The UI polls for status every few seconds. When done, results appear as a score table.

### Sidecar API Reference

The sidecar exposes these endpoints (all on `http://localhost:8001`):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — confirms Groq key is loaded |
| `GET` | `/tasks` | List all supported benchmark task IDs and labels |
| `POST` | `/run` | Start a new evaluation run (requires `x-sidecar-secret` header) |
| `GET` | `/status/{runId}` | Poll in-memory run state (requires `x-sidecar-secret` header) |
| `GET` | `/docs` | FastAPI interactive docs (Swagger UI) |

**Auth header required on `/run` and `/status`:**
```
x-sidecar-secret: <value of SIDECAR_SECRET in scripts/eval-service/.env>
```

### Supported Benchmark Tasks

| Task ID | Label | Category | ~Samples |
|---------|-------|----------|----------|
| `arc_easy` | ARC Easy | Reasoning | 2,376 |
| `arc_challenge` | ARC Challenge | Reasoning | 1,172 |
| `hellaswag` | HellaSwag | Common Sense | 10,042 |
| `winogrande` | Winogrande | Common Sense | 1,267 |
| `truthfulqa_mc1` | TruthfulQA (MC1) | Knowledge | 817 |
| `mmlu` | MMLU (Full) | Knowledge | 14,042 |
| `boolq` | BoolQ | Reasoning | 3,270 |
| `piqa` | PIQA | Common Sense | 1,838 |

### Key Implementation Notes

- **Evaluation runs in a daemon background thread** — the sidecar returns immediately after `POST /run`; the actual benchmark runs asynchronously. Results are posted back to Next.js via the webhook at `/api/eval/webhook` on completion.
- **`num_concurrent: 1`** is enforced in `evaluator.py` to respect Groq's rate limits. Evaluations with many samples will take time.
- **In-memory state only** — the sidecar tracks run state in a Python dict (`_run_states`). Restarting the sidecar loses all in-progress run state. The Next.js frontend falls back to Supabase for persisted run history.
- **The sidecar runs as a local process only** — it is not part of the Next.js process and must be started separately each development session.
- **Groq Adapter** (`groq_adapter.py`) configures `lm_eval` to use Groq's `https://api.groq.com/openai/v1` endpoint as an OpenAI-compatible API via the `local-chat-completions` model type.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/dashboard/benchmarks` returns 404 | You're not in `NODE_ENV=development`. Only works with `npm run dev`. |
| `GROQ_API_KEY not configured on sidecar` | Fill in `GROQ_API_KEY` in `scripts/eval-service/.env` |
| `Invalid sidecar secret` (401) | `SIDECAR_SECRET` in `scripts/eval-service/.env` must match `EVAL_SIDECAR_SECRET` in `.env.local` |
| Sidecar not starting | Run `npm run eval:setup` first to install Python dependencies |
| `python` not found during setup | Install Python 3.9+ and ensure it's on your PATH |
| Webhook errors in sidecar logs | Confirm Next.js is running on port 3000 and `NEXTJS_BASE_URL` is correct in `scripts/eval-service/.env` |

---

## Known Gaps (from audit_report.md)

These are deliberate blockers, not bugs:

| Gap | Status |
|-----|--------|
| Account deletion | Blocked — needs audited cascade strategy |
| Billing / Stripe checkout | Blocked — no provider integration |
| World soft-delete / archive | Not implemented |
| Entity merge | **Implemented (Phase 5)** — see Phase 5 documentation |
| Manual entity creation | Not implemented |
| Lore edit vs. re-ingest differentiation | Partial — edits always re-run full pipeline |
| Markdown/ZIP export | JSON-only currently |
| `FractureLens` + `ConsistencyChecker` consolidation | Partial — Phase 6 inline popover largely replaces standalone checker, but both still exist |

---

## Non-Obvious Implementation Notes

1. **`export const dynamic = "force-dynamic"`** must be at the top of every API route file. Without it, Next.js static analysis fails at build time.

2. **`auth/page.tsx` needs `<Suspense>`** wrapping `<AuthShell />` because `useSearchParams()` requires a Suspense boundary.

3. **Soul regeneration** uses `soulId` param: POST `/api/souls/generate` with `soulId` updates existing soul card without counting against create limit.

4. **Streaming chat** is plain text (`text/plain`), not JSON. Client uses `ReadableStream` decoder, not `EventSource`.

5. **SSE lore ingest fallback** streams events as `event: name\ndata: {...}\n\n`. Client reads with `ReadableStream` decoder (not `EventSource` — doesn't support POST).

6. **Semantic cache threshold** is `0.98` (cosine similarity). Defined in `lib/constants.ts` as `SEMANTIC_CACHE_THRESHOLD`. Very high threshold — reduces false cache hits at the cost of cache coverage. Tune down cautiously.

7. **ImpactResult fields are all optional** (`affected?`, `orphaned?`, `invalidated?`) — AI can return partial objects. Always use optional chaining: `impactResult.affected?.length > 0`.

8. **Inngest `createFunction` signature** takes 2 arguments: config object (with `id`, `retries`, `triggers`, `onFailure`) and handler function. The trigger goes inside the config as `triggers: [{ event: "lore.inscribed" }]`, not as a separate third argument.

9. **`lib/data.ts` `getWorldWorkspaceData`** must include `folders: []` and `relationships: []` in both the demo return and the real return — `WorldWorkspaceData` type requires these fields.

10. **`lib/env.ts` must use dot notation** for `NEXT_PUBLIC_*` vars: `process.env.NEXT_PUBLIC_SUPABASE_URL`, never `process.env[name]`. Dynamic bracket access prevents Next.js from inlining vars into client bundles.

11. **`useDraftStore`** (Zustand + persist) saves offline drafts by `entryId`. Call `getDraft(entryId)` on editor mount to restore; call `clearDraft(entryId)` after successful save.

12. **`AmbientAudioProvider`** is mounted in root `layout.tsx` (server component, "use client" inside). It persists across all route navigations. The `AmbientToggle` button is in the world sidebar header.

13. **`WorldSidebar`** with `isDemo=true`: Compass icon links to `/` instead of `/dashboard`. Mobile nav only shows first 5 of the 7 sections.

14. **pgvector similarity search** (`match_lore_chunks`, `match_semantic_cache`) uses IVFFlat index, cosine similarity, 768 dimensions (Gemini `gemini-embedding-2-preview`). Embeddings are still generated by Gemini — Groq does not provide embedding models.

15. **Rate limits are not atomic** — theoretical race condition on concurrent requests. Acceptable at current scale.

16. **`tsconfig.json` requires `"target": "ES2017"` and `"downlevelIteration": true`** for spread/iteration on `Map.values()` and `Set`.

17. **`suppressHydrationWarning`** on timestamps rendered with `formatRelativeTime()` — value differs between SSR and client hydration.

18. **Demo mode**: `WorldWorkspace` receives `data.world.is_demo`, passes `isDemo` down to sidebar and `EchoesInterface`. Demo soul chat uses `/api/demo/chat` (no auth, no rate limit). Demo header shows "Sign up free" instead of "← Dashboard".

19. **AI model split (post-Groq migration):** Groq handles ALL text generation — `llama-3.3-70b-versatile` (`GROQ_MODEL_HEAVY`) for soul forge, entity extraction, consistency checks, impact analysis, timeline ordering, tavern, blank spot detection, declarative fact detection; `llama-3.1-8b-instant` (`GROQ_MODEL_FAST`) for soul chat streaming, autocomplete, and quick classification. Gemini is **embeddings only** — `gemini-embedding-2-preview` (768-dim). Do NOT call `getGeminiModel()` or `getChatModel()` — those functions no longer exist in `lib/gemini.ts`.

20. **`DialogContent` base class** (`components/ui/dialog.tsx`) includes `max-h-[min(92vh,860px)] overflow-y-auto overflow-x-hidden` to ensure all modals are viewport-safe and scrollable on short screens. Do not pass redundant `max-h` or `overflow` overrides from individual modal components.

21. **Archive incremental refresh**: `GET /api/entities?worldId=<id>&since=<ISO>` returns only entities with `updated_at > since`. The `WorldWorkspace` tracks `lastRefreshed` state and merges returned entities by `id` into the existing `entities` state — the `ConstellationCanvas` reacts automatically. The refresh button is hidden for demo worlds.

22. **`SectionLoadingScreen`** exported from `components/shared/loading-shimmer.tsx` — accepts `label` and `subtitle` props. Renders an animated arcane loading animation (orbiting runes, pulsing orb, Framer Motion) used during section tab transitions in `WorldWorkspace`. The legacy `LoadingShimmer` component is also still exported from the same file.

23. **Global Theme Provider**: Inside `app/layout.tsx`, `<ThemeProvider>` operates without the `disableTransitionOnChange` prop. This deliberate omission allows `globals.css` to orchestrate a beautifully eased `0.45` second color transition (`var(--ease-drawer)`) between user theme preferences rather than jarring frame snaps.

24. **`ConstellationCanvas` cannot read CSS vars directly** — the canvas 2D context has no access to CSS custom properties. Use `resolveThemeColors()` which calls `getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()` each animation frame (browser-cached, zero perf cost).

25. **`ArchiveWorkspace` owns `viewMode` state** for the Bible section. `ConstellationDossier` reads from `useWorkspaceStore` (not local state), so it works regardless of which view mode is active. The `ConstellationDossier` is rendered inside the constellation view panel, positioned `absolute` (not `fixed`).

26. **`useForceLayout` in `ArchiveWeb`** runs an 80-tick pure-JS simulation on mount (no library). Nodes start in a circle, apply repulsion (REPEL=2800, 1/distance²), edge attraction (ATTRACT=0.04), center gravity (CENTER=0.02), and damping (0.75). The simulation is synchronous on mount — do not run it in a `requestAnimationFrame` loop (too slow for initial render).

27. **`LoomEditor` Oracle Whisper CTA** — the floating Sparkles button is only visible when the editor has focus AND `wordCount > 20` AND not in focus mode. It calls `POST /api/lore/autocomplete` with the current content and inserts the returned suggestion at the cursor.

28. **`parseSoulCard` uses `repairAndParseJSON`** — like all other AI output parsers. Do not replace with raw `JSON.parse`; Groq's Llama models can occasionally emit preamble text or markdown fences before the JSON object.

29. **`CommandPalette` must receive the live `entities` state** from `WorldWorkspace`, not the initial `data.entities` prop. The state is updated by `refreshArchive`. Using the prop directly would hide newly discovered entities.

30. **`canCreateSoul` in `WorldWorkspace`** uses `FREE_TIER_LIMITS.soulsPerWorld` from `lib/constants.ts` — do not hardcode `3`.

31. **`AetherBackground` CSS vars** — sets `--mouse-x` and `--mouse-y` on `document.documentElement`. These are safe to read in any CSS anywhere in the app for cursor-following effects.

32. **Dashboard `/api/dashboard` route** has a per-world stats loop that makes 3 parallel queries per world (N×3 queries). Acceptable at current world count (free tier = 1 world), but watch this if limits increase.

33. **`@anthropic-ai/sdk` in `package.json`** — present but unused. Do not introduce Anthropic API calls. All text generation runs through Groq; embeddings run through Gemini.

34. **Lore Scribe toolbar uses `.loom-toolbar-btn` CSS class** (not Tailwind `transition`) — this class in `globals.css` pins transitions to exactly `background-color 120ms`, `color 120ms`, `transform 80ms` with `var(--ease-snap)` easing and an instant `active: scale(0.93)`. Reverting to `transition` class causes the global 0.45s transition to bleed in, making buttons feel laggy.

35. **Lore Scribe has 12 toolbar buttons** plus an Oracle Whisper button. Buttons are grouped by separators (`<span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />`): headings group (H1/H2/H3) | inline group (Bold/Italic/Strike/Highlight/Code) | block group (Quote/Bullet/Ordered/HR). Requires `Highlight` extension from `@tiptap/extension-highlight` and `Fragment` import from React.

36. **`ArchiveWeb` has a mobile list view** — on viewports < 768px, the force-directed SVG graph is replaced by a grouped accordion list of entities with inline relationship expansion. The switch is via `isMobile` state set by a `resize` event listener. Desktop retains the existing SVG graph with `touch-action: none`.

37. **World creation tone cards** use tone-specific Lucide icons (Skull=Dark, Mountain=Epic, Wand2=Whimsical, Eye=Mystery, Ghost=Horror, Sun=Hopeful). Active state for both genre and tone cards: `border-2 border-[var(--accent)]` + accent background + `scale-[1.02]` + absolute `Check` icon in top-right. `rounded-xl` on all cards (was `rounded-[24px]`).

38. **Global border-radius principle**: large container surfaces use `rounded-xl` (12px) or `rounded-2xl` (16px) max. Pill shapes (dock, badges, `rounded-full` avatars) are intentionally kept. Do NOT revert to `rounded-[28px]` or larger on container cards — the project intentionally moved away from the bubbly AI-app aesthetic.

39. **Groq SDK message format** uses OpenAI-compatible `{role, content}` pairs (not Gemini's `{role, parts: [{text}]}` format). Soul chat history conversion: `role === "assistant"` maps to `"assistant"` (not `"model"` as in Gemini). The `GroqMessage` type from `lib/groq.ts` enforces this.

40. **`hasAiEnv()` in `lib/env.ts`** now checks for both `GROQ_API_KEY` (generation) AND `GEMINI_API_KEY` (embeddings). Both must be present. The 503 error detail reads: `"Missing GROQ_API_KEY or GEMINI_API_KEY on the server."`

41. **Daily chat limit is 5** (`DAILY_LIMITS.chat_message = 5` in `lib/constants.ts`), reduced from 50 during the Groq migration to manage resource usage. Update tests or any hardcoded `50` references accordingly.

---

## Architectural Upgrade — Phases 1–6 (May 2026)

### Phase 1 — Database Schema Expansion
Migration file: `supabase/migrations/20260507000001_phase1_expansion.sql`

- `tavern_sessions` → added `premise TEXT`, `canonized BOOLEAN DEFAULT FALSE`, `canonized_lore_entry_id UUID FK → lore_entries`
- `entity_relationships` → added `tension_score SMALLINT DEFAULT 0 CHECK (-1..1)` (`-1` hostile, `0` neutral, `1` allied)
- `lore_chunks` → added `entity_id UUID FK → entities ON DELETE SET NULL` for direct merge targeting
- All FKs on `lore_chunks`, `consistency_flags`, `entity_relationships` hardened with `ON DELETE CASCADE`

### Phase 2 — Scene Forge Canonization Pipeline
- `app/api/tavern/canonize/route.ts` — POST. Transforms a tavern session transcript into a canonical lore entry via Groq `llama-3.3-70b-versatile`. Creates a `lore_entries` record and marks the session `canonized=true` + `canonized_lore_entry_id`.
- `components/tavern/tavern-chat.tsx` — "Inscribe to Canon" banner and premise textarea.
- `app/api/tavern/route.ts` — updated INSERT to persist `premise`.

### Phase 3 — Lore Bounties
- `app/api/narrator/route.ts` → added `GET ?action=blank-spots&worldId=` handler. Bypasses standard POST rate limiting (uses narrator action limit separately).
- `components/dashboard/lore-bounty-modal.tsx` — modal with embedded TipTap editor that seeds starting verses via the autocomplete API.
- `components/dashboard/dashboard-overview.tsx` — world-picker `<select>` (hidden if only 1 world), bounties panel with animated quest cards. Clicking a card opens `LoreBountyModal`. Bounty cache invalidated on resolution.

42. **Bounty cache** is per-world in `dashboard-overview.tsx`: `bountiesFetched: Record<string, boolean>`. Delete the world key to force a re-fetch (done automatically on `handleBountyClaimed`).

### Phase 4 — Tension-Aware Relationship Mapping
- `app/api/relationships/route.ts` — `tensionScore` field added to create schema (`-1|0|1`, default 0).
- `components/bible/forge-relationship-modal.tsx` — three-button tension selector (Hostile/Neutral/Allied) renders above the label field. Colors: `var(--danger)` / `var(--text-muted)` / `var(--success)`.
- `components/bible/archive-web.tsx`:
  - `edgeColor(tensionScore, highlighted)` helper maps `-1→danger`, `1→success`, `0→accent/border`.
  - Hostile/allied edges render solid (no dasharray); neutral edges remain dashed.
  - **"Conflicts Only" toggle** (floating top-right, `Swords` icon) filters graph to show only hostile (`tension_score === -1`) relationships.

43. **`ArchiveWeb` tension filter** sets `visibleRelationships = conflictsOnly ? relationships.filter(r => r.tension_score === -1) : relationships`. Both `visibleEntities` and the force layout `edges` array derive from `visibleRelationships`.

### Phase 5 — Entity Merging Pipeline
- `app/api/entities/merge/route.ts` — POST `{ worldId, primaryEntityId, secondaryEntityId }`.
  - Re-points all `entity_relationships.source_entity_id` / `target_entity_id` rows from secondary → primary (guards against self-loop duplication).
  - Re-points `lore_chunks.entity_id`.
  - Calls `replace_entity_tag` Postgres RPC (best-effort; safe to not exist).
  - Merges `mention_count` values.
  - Deletes secondary entity (CASCADE removes straggler relations).
- `components/bible/entity-merge-modal.tsx` — two-step UI: entity picker (filtered to same `type`), irreversible-action confirmation checkbox, and danger-styled "Execute Merge" button.
- `components/bible/entity-detail-panel.tsx` — added `allEntities: Entity[]` prop, `onMerge?: (deletedId: string) => void` prop, `mergeModalOpen` state, "Merge" ghost button next to "Delete Entity" in the footer.

44. **Entity merge guards**: the API rejects `primaryEntityId === secondaryEntityId` with `CANNOT_MERGE_SELF (400)` and verifies world membership before any mutations.

### Phase 6 — Inline FractureLens Consistency Checking
- `app/api/consistency/check/route.ts` — `?inline=true` query param skips `checkAndIncrement` rate limiting. Standard manual checks (no `inline` param) remain restricted to 5/day.
- `components/lore/consistency-inline-popover.tsx` — compact popover rendered below TipTap editor showing:
  - Loading spinner while checking
  - Severity badges (Critical/Warning/Minor) using `var(--danger)`, `var(--accent)`, `var(--text-muted)`.
  - Expandable flag detail rows (contradiction text + archive reference).
  - Per-flag dismiss (X button) and "dismiss all" link.
- `components/lore/loom-editor.tsx`:
  - `inlineFlags: InlineFlag[]` + `inlineChecking: boolean` state.
  - `inlineDebounceRef` — `setTimeout` handle cleared on each editor update.
  - On editor `onUpdate`: if `!isReadonly && selectedEntry && text.length >= 80`, schedules an inline check after **5 seconds idle**. Sends `POST /api/consistency/check?inline=true` with `text.slice(0, 2000)`.
  - `ConsistencyInlinePopover` rendered below `<EditorContent>`.

45. **Inline FractureLens does not count against the 5/day limit.** Only direct user-initiated consistency checks via the Lore Lens panel are rate-limited. The inline call uses `?inline=true` to bypass the counter.

46. **`InlineFlag` type** (`components/lore/consistency-inline-popover.tsx`) mirrors `ConsistencyFlag` from the database but with client-side `resolved: boolean` for optimistic dismissal without a network call.

### Final Audit (Completed)
- All legacy `.js`/`test` files have been purged.
- The codebase passes `npx tsc --noEmit` with zero errors, ensuring strict type-safety across all new phase integrations (Entity Merge, Tension Scores, etc.).
