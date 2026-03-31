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
| AI — All features | Google Gemini (`gemini-2.5-pro` for generation, `gemini-2.5-flash` for chat, `gemini-embedding-2-preview` for embeddings) |
| Background Jobs | Inngest (multi-step functions, retry/backoff, dead-letter queue) |
| Rich Text | TipTap (StarterKit + CharacterCount + Placeholder) |
| State | Zustand (`useWorkspaceStore`, `useDraftStore`, `useAmbientStore`) |
| Forms | React Hook Form + Zod |
| Command Palette | cmdk |
| Notifications | Sonner |

**Important:** All AI runs through Gemini. `GEMINI_API_KEY` is the only AI key required.

---

## Features

### 1. Lore Scribe — The Enchanted Editor

**What it does:** A rich text editor where writers pour their world's lore. When submitted, the text is sent to Inngest for background processing (chunked, embedded into pgvector, entities extracted). Falls back to synchronous SSE if Inngest is unavailable.

**Implementation:**
- TipTap editor with heading/bold/italic/blockquote/list support
- Title + content saved as a `lore_entries` record with `processing_status` field
- **Primary path:** POST `/api/lore/ingest` → sends `lore.inscribed` event to Inngest → returns `{ jobId, mode: "background" }`
- **Fallback path:** SSE stream if Inngest unavailable: `saved → chunking → embedding_progress → embedding_complete → entity_extraction → complete`
- Processing status polled via GET `/api/lore/status?entryId=` for background jobs
- Lore entries can be organized into **folders** (CRUD via `/api/lore/folders`)
- **Oracle's Whisper:** POST `/api/lore/autocomplete` — AI writing continuation suggestions
- Ctrl+S / Cmd+S keyboard shortcut to inscribe
- **Offline auto-save:** `useDraftStore` (Zustand, persisted to localStorage) saves draft every 30s; discards drafts older than 24h

**Rate limit:** 10 lore ingest per day
**Free tier cap:** 50 lore entries per world

**Key copy:** "Inscribe & Remember" (button), "Inscribing..." (loading)

---

### 2. The Archive (World Bible) — Entity Memory

**What it does:** Automatically extracts and organizes entities from lore into a browsable archive with an interactive constellation map.

**Implementation:**
- Entities in `entities` table: type, name, summary, mention_count, entity_tags
- Tab-based grid (character, location, faction, artifact, event, rule)
- `ConstellationCanvas` — interactive canvas (zoom/pan, type-specific shapes, faction membership hierarchy)
- `ConstellationDossier` — side panel: summary, lore fragments, associated characters, "Forge Soul from X" CTA
- Entity relationships stored in `entity_relationships` table via POST `/api/relationships`
- **Incremental Refresh**: GET `/api/entities?worldId=<id>&since=<ISO>` returns only entities updated after `since`. A "Refresh Archive" button in the Bible overlay calls this endpoint and merges new/updated entities into the live constellation without a full page reload. Hidden on demo worlds.

**Entity types:** character, location, faction, artifact, event, rule

---

### 3. Bound Souls — Character AI Personas

**What it does:** Forge characters into AI personas with voice, memory, secrets, and knowledge shaped by the lore. Chat with them directly.

**Soul Card structure (JSONB):**
- `voice`, `core`, `knows` (5-8), `doesnt_know` (3-5), `relationships` (3-5), `secrets` (2-3), `sample_lines` (exactly 3)

**Implementation:**
- POST `/api/souls/generate` — Gemini 2.5 Pro, Zod-validated via `lib/soul-card.ts`
- POST `/api/souls/chat` — **semantic cache layer** (pgvector similarity on recent prompts, threshold 0.92); cached responses served instantly; new responses streamed and cached
- Source attribution: `source_chunk_ids` stored on messages for traceable lore references
- Memory imprinting: `detectDeclarativeFact()` detects user statements → stored as persistent facts

**Rate limits:** 3 soul generate/day, 50 chat messages/day

---

### 4. The Tapestry — Chronological Timeline

**What it does:** AI-ordered timeline of all world events. The Oracle reads lore entries and arranges events in chronological order grouped by inferred era.

**Implementation:**
- POST `/api/narrator` with `action: "timeline"` → `orderEventsChronologically()` (Gemini)
- Events grouped into eras (Early Age, Rise of Empires, etc.)
- Visual vertical timeline with era dividers and animated event cards
- Component: `components/tapestry/tapestry-timeline.tsx`

---

### 5. The Tavern — Multi-Soul Chat

**What it does:** Gather 2-4 souls in a shared scene. Direct the conversation or address specific souls; they respond in voice, reacting to each other and the world's lore.

**Implementation:**
- Sessions stored in `tavern_sessions` table; messages in `tavern_messages`
- GET `/api/tavern?worldId=` — list/create sessions
- POST `/api/tavern` — `{ sessionId, userMessage, directedToSoulId? }` → `generateTavernResponse()`
- Gemini receives all souls' cards + world lore + conversation history
- Soul responds according to their voice and what they know; can be directed at a specific soul
- **Daily limit:** 20 tavern messages/day (configurable via `TAVERN_DAILY_LIMIT` constant)
- Component: `components/tavern/tavern-chat.tsx`

---

### 6. The Narrator's Eye — Consistency Radar

**What it does:** Paste new writing; the archive checks it against established lore for contradictions.

**Implementation:**
- POST `/api/consistency/check` — dual retrieval (embedding similarity + entity-tag overlap), Gemini contradiction analysis
- Returns `ConsistencyFlag[]` with severity (low/medium/high)
- Flags stored in `consistency_flags`, resolvable via POST `/api/consistency/resolve`

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
- **All `ImpactResult` fields are optional** — always use optional chaining (`?.`) when accessing `affected`, `orphaned`, `invalidated`
- Component: `components/narrator/narrator-tools.tsx`

---

### 8. Dashboard — Overview Center

**What it does:** Landing page after login showing all worlds, global stats, and recent activity feed.

**Implementation:**
- Server component: `app/dashboard/page.tsx` — parallel Supabase queries for worlds, counts, recent activity
- `DashboardOverview` client component with animated world cards, stat counters, scrollable activity feed
- Activity types: `lore_created`, `soul_forged`, `consistency_check`, `chat_message`, `entity_discovered`
- World cards link directly to each world workspace

---

### 9. Global Command Palette (Cmd+K)

**What it does:** Keyboard-first navigation across entities, souls, and lore entries. Supports direct soul chat shortcuts.

**Implementation:**
- `components/shared/command-palette.tsx` — powered by `cmdk`
- Triggered by Cmd+K / Ctrl+K anywhere in the world workspace
- Searches: entities (with type icons), bound souls (→ route to chat), lore entries (→ route to scribe)
- Mounted inside `WorldWorkspace` with access to `entities`, `souls`, `loreEntries` props

---

### 10. Ambient Audio

**What it does:** Optional dark fantasy atmosphere — subtle low-frequency synth pads and crackling noise, generated with Web Audio API (no external audio files).

**Implementation:**
- `components/shared/ambient-audio.tsx`
- `AmbientAudioProvider` — mounted in root `layout.tsx`, persists across routes
- `useAmbientStore` (Zustand, persisted to localStorage) — tracks `enabled` + `volume`
- `AmbientToggle` button — shown in world sidebar header
- Uses oscillators (55Hz, 82.5Hz, 110Hz) + bandpass-filtered noise buffer

---

## Rate Limits

All per-user, per-day (reset midnight UTC):

| Action | Limit |
|--------|-------|
| Chat messages | 50/day |
| Lore ingest | 10/day |
| Consistency checks | 5/day |
| Soul generate | 3/day |
| Tavern messages | 20/day |

**Key copy:** "The spellwork needs to rest.", "Today's Ink" (usage meter label)

---

## Free Tier Limits

| Resource | Limit |
|----------|-------|
| Worlds | 1 |
| Souls per world | 3 |
| Lore entries per world | 50 |

---

## Design System

### Colors (Warm Sepia Dark Fantasy)

All hues are warm (25-35° range), NOT cold blue (240°):

| Token | HSL | Hex (approx) | Usage |
|-------|-----|------|-------|
| background | 25 15% 5% | #0d0b08 | Page background |
| foreground | 40 30% 93% | #f0ead8 | Body text |
| card | 28 14% 9% | #15120d | Card surfaces |
| card-elevated | 32 16% 12% | #1e1810 | Elevated panels |
| border | 35 18% 20% | #362c22 | All borders |
| primary | 272 40% 54% | #7c5cbf | Arcane purple |
| accent | 41 59% 58% | #d4a853 | Gold |
| danger | 0 48% 52% | #c04a4a | Error/danger |

### Typography

- **Headings:** `font-heading` → Crimson Pro (serif)
- **Body:** `font-sans` → Inter
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
| `bible` | The Archive | `ConstellationCanvas` + `ConstellationDossier` |
| `souls` | Bound Souls | `SoulCard` grid + `EchoesInterface` |
| `consistency` | Narrator's Eye | `FractureLens` |
| `tapestry` | The Tapestry | `TapestryTimeline` |
| `tavern` | The Tavern | `TavernChat` |
| `narrator` | Narrator's Tools | `NarratorTools` |

### Data Flow — Lore Ingest (Primary: Inngest)

```
User writes lore
  → POST /api/lore/ingest
    → Save lore_entry (processing_status: "pending")
    → inngest.send("lore.inscribed", { worldId, entryId, content, userId })
    → Return { jobId, mode: "background" }
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
    → Embed prompt (Gemini gemini-embedding-2-preview)
    → Query semantic_cache (match_semantic_cache RPC, threshold 0.92)
    → Cache HIT: return cached response (instant, increment hit_count)
    → Cache MISS:
      → Fetch soul card + conversation history + lore_chunks
      → Gemini 2.5 Pro streams response
      → Store in semantic_cache for future hits
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
| `lib/constants.ts` | DAILY_LIMITS, FREE_TIER_LIMITS, WORLD_SECTIONS (7 sections) |
| `lib/gemini.ts` | Gemini client singleton; `getGeminiModel()` → `gemini-2.5-pro`, `getChatModel()` → `gemini-2.5-flash` |
| `lib/embeddings.ts` | All AI functions (embedText [gemini-embedding-2-preview], extractEntities, generateAutocomplete, analyzeImpact, detectBlankSpots, orderEventsChronologically, generateTavernResponse, detectDeclarativeFact) + Zod validation |
| `lib/json-repair.ts` | Robust JSON parsing for malformed AI outputs |
| `lib/store.ts` | Zustand: `useWorkspaceStore` (section/modals/entity/soul), `useDraftStore` (offline auto-save), `useAmbientStore` (in ambient-audio.tsx) |
| `lib/inngest-client.ts` | Inngest SDK singleton |
| `lib/inngest/lore-ingest.ts` | Multi-step lore background function |
| `lib/soul-card.ts` | Soul card Zod schema + prompt + parser |
| `lib/chunker.ts` | Text chunking (~400 words + sentence overlap) |
| `lib/data.ts` | Server-side fetching; `getWorldWorkspaceData` returns `folders: []` and `relationships: []` |
| `lib/mock-data.ts` | Demo world "Ashveil" data |
| `lib/rate-limit.ts` | Per-user per-day rate limiting |
| `lib/env.ts` | Env var accessors — MUST use dot notation |
| `app/api/entities/route.ts` | GET `/api/entities?worldId=&since=<ISO>` — incremental entity fetch for archive refresh |
| `components/worlds/world-workspace.tsx` | Main workspace; renders all 7 sections + CommandPalette + archive refresh logic |
| `components/layout/world-sidebar.tsx` | 7-section nav + AmbientToggle; mobile shows first 5 |
| `components/shared/command-palette.tsx` | Cmd+K palette (cmdk) |
| `components/shared/ambient-audio.tsx` | Web Audio API ambient system + AmbientToggle |
| `components/shared/loading-shimmer.tsx` | `LoadingShimmer` (legacy) + `SectionLoadingScreen` (themed arcane loading animation with orbiting runes) |
| `components/tapestry/tapestry-timeline.tsx` | Chronological event timeline |
| `components/tavern/tavern-chat.tsx` | Multi-soul conversation UI |
| `components/narrator/narrator-tools.tsx` | Impact simulator + lore hole detection |
| `components/dashboard/dashboard-overview.tsx` | Dashboard stats + world cards + activity feed |
| `supabase/migrations/` | All DB schema migrations |

### Supabase Schema (17 Tables)

**Original 11:**
- `profiles`, `worlds`, `lore_entries` (+ `folder_id`, `processing_status`, `inngest_event_id`), `lore_chunks`, `entities`, `souls`, `conversations`, `messages` (+ `source_chunk_ids`), `consistency_checks`, `consistency_flags`, `rate_limits`

**New 6 (feature expansion migration):**
- `failed_jobs` — Inngest dead-letter queue (status: failed/retrying/resolved)
- `semantic_cache` — pgvector cache for soul chat prompts (hit_count, prompt_embedding)
- `lore_folders` — hierarchical folder organization for lore entries
- `entity_relationships` — user-defined edges between entities (label, description)
- `tavern_sessions` — multi-soul chat sessions (soul_ids array)
- `tavern_messages` — individual tavern messages (role: user/director/soul, directed_to)

**New RPCs:**
- `match_semantic_cache(query_embedding, world_id, soul_id, similarity_threshold, match_count)` — pgvector similarity search on cache

All tables have RLS enforcing `user_id` ownership.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key (browser-safe)
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key (server only — used by Inngest worker)
GEMINI_API_KEY=                 # Google Gemini API key (all AI features)
INNGEST_EVENT_KEY=              # Inngest event key (use "test" for local dev; get real key from app.inngest.com for production)
```

---

## Dev Commands

```bash
npm run dev                    # Start Next.js dev server (http://localhost:3000)
npm run build                  # Production build (must pass with 0 errors)
npm run lint                   # ESLint check
npx inngest-cli@latest dev     # Start Inngest dev server (http://localhost:8288) — required for background jobs
supabase start                 # Start local Supabase
supabase db reset              # Reset local DB and run all migrations
```

---

## Non-Obvious Implementation Notes

1. **`export const dynamic = "force-dynamic"`** must be at the top of every API route file. Without it, Next.js static analysis fails at build time.

2. **`auth/page.tsx` needs `<Suspense>`** wrapping `<AuthShell />` because `useSearchParams()` requires a Suspense boundary.

3. **Soul regeneration** uses `soulId` param: POST `/api/souls/generate` with `soulId` updates existing soul card without counting against create limit.

4. **Streaming chat** is plain text (`text/plain`), not JSON. Client uses `ReadableStream` decoder, not `EventSource`.

5. **SSE lore ingest fallback** streams events as `event: name\ndata: {...}\n\n`. Client reads with `ReadableStream` decoder (not `EventSource` — doesn't support POST).

6. **Semantic cache threshold** is `0.92` (cosine similarity). Defined in `lib/constants.ts` as `SEMANTIC_CACHE_THRESHOLD`. Tune down to get more cache hits at the cost of accuracy.

7. **ImpactResult fields are all optional** (`affected?`, `orphaned?`, `invalidated?`) — AI can return partial objects. Always use optional chaining: `impactResult.affected?.length > 0`.

8. **Inngest `createFunction` signature** takes 2 arguments: config object (with `id`, `retries`, `triggers`, `onFailure`) and handler function. The trigger goes inside the config as `triggers: [{ event: "lore.inscribed" }]`, not as a separate third argument.

9. **`lib/data.ts` `getWorldWorkspaceData`** must include `folders: []` and `relationships: []` in both the demo return and the real return — `WorldWorkspaceData` type requires these fields.

10. **`lib/env.ts` must use dot notation** for `NEXT_PUBLIC_*` vars: `process.env.NEXT_PUBLIC_SUPABASE_URL`, never `process.env[name]`. Dynamic bracket access prevents Next.js from inlining vars into client bundles.

11. **`useDraftStore`** (Zustand + persist) saves offline drafts by `entryId`. Call `getDraft(entryId)` on editor mount to restore; call `clearDraft(entryId)` after successful save.

12. **`AmbientAudioProvider`** is mounted in root `layout.tsx` (server component, "use client" inside). It persists across all route navigations. The `AmbientToggle` button is in the world sidebar header.

13. **`WorldSidebar`** with `isDemo=true`: Compass icon links to `/` instead of `/dashboard`. Mobile nav only shows first 5 of the 7 sections.

14. **pgvector similarity search** (`match_lore_chunks`, `match_semantic_cache`) uses IVFFlat index, cosine similarity, 768 dimensions (Gemini `text-embedding-004`).

15. **Rate limits are not atomic** — theoretical race condition on concurrent requests. Acceptable at current scale.

16. **`tsconfig.json` requires `"target": "ES2017"` and `"downlevelIteration": true`** for spread/iteration on `Map.values()` and `Set`.

17. **`suppressHydrationWarning`** on timestamps rendered with `formatRelativeTime()` — value differs between SSR and client hydration.

18. **Demo mode**: `WorldWorkspace` receives `data.world.is_demo`, passes `isDemo` down to sidebar and `EchoesInterface`. Demo soul chat uses `/api/demo/chat` (no auth, no rate limit). Demo header shows "Sign up free" instead of "← Dashboard".

19. **Gemini model strings** (as of the current API key): `gemini-2.5-pro` for all heavy generation (entity extraction, consistency, autocomplete, impact analysis, timeline ordering, tavern, declarative fact detection), `gemini-2.5-flash` for conversational soul chat, `gemini-embedding-2-preview` for vector embeddings. The `gemini-1.5-*` series is **not supported** by the current API key. Do not revert to it.

20. **`DialogContent` base class** (`components/ui/dialog.tsx`) includes `max-h-[min(92vh,860px)] overflow-y-auto overflow-x-hidden` to ensure all modals are viewport-safe and scrollable on short screens. Do not pass redundant `max-h` or `overflow` overrides from individual modal components.

21. **Archive incremental refresh**: `GET /api/entities?worldId=<id>&since=<ISO>` returns only entities with `updated_at > since`. The `WorldWorkspace` tracks `lastRefreshed` state and merges returned entities by `id` into the existing `entities` state — the `ConstellationCanvas` reacts automatically. The refresh button is hidden for demo worlds.

22. **`SectionLoadingScreen`** exported from `components/shared/loading-shimmer.tsx` — accepts `label` and `subtitle` props. Renders an animated arcane loading animation (orbiting runes, pulsing orb, Framer Motion) used during section tab transitions in `WorldWorkspace`. The legacy `LoadingShimmer` component is also still exported from the same file.

23. **Global Theme Provider**: Inside `app/layout.tsx`, `<ThemeProvider>` operates without the `disableTransitionOnChange` prop. This deliberate omission allows `globals.css` to orchestrate a beautifully eased `0.45` second color transition (`var(--ease-drawer)`) between user theme preferences rather than jarring frame snaps.
