# Design Document

## Overview

This design translates the 24 ship-plan requirements into a concrete technical
approach across the four ship phases. It is organized so that each phase can be
implemented and committed independently, ending in a green `next build`.

The work is small-to-medium in scope but touches many files. It falls into five
technical categories:

1. **Repo/build hygiene** (Phase 0) — Git line-ending policy, litter removal,
   `package.json` metadata, and a GitHub Actions CI workflow.
2. **API-layer correctness** (Phase 1) — a Postgres RPC + migration, rate-limit
   and access-guard wiring, IP throttling, fail-closed auth, and Sentry
   instrumentation.
3. **Editor / client behavior** (Phase 1/2) — wiring persisted focus-mode
   preferences into the immersive editor, reduced-motion, and touch recovery.
4. **UX repair + dead-code removal** (Phase 2) — mobile nav overflow sheet,
   waitlist capture, control removal, theme tokens, sitemap.
5. **Docs + tests + launch** (Phase 3) — documentation rewrite, `.env.example`,
   README, route-handler tests (vitest + msw), and the launch checklist.

The stack is Next.js 14 App Router + Supabase (Postgres + RLS) + Inngest +
TypeScript, with Groq for generation and HuggingFace for embeddings. All code
examples below are TypeScript / TSX / SQL to match the existing codebase.

### Design Principles

- **Fail closed.** Rate limiting, access guards, and secret checks reject on
  ambiguity rather than allowing traffic through (matches the existing
  `checkAndIncrement` behavior).
- **Reuse existing helpers.** `requireUser`, `requireWorldAccess`,
  `checkAndIncrement`, `jsonRateLimited`, `withErrorMonitoring`,
  `getClientIp`/`checkAuthRateLimit`, and the AetherDock sheet pattern all
  already exist; the design wires them in rather than inventing new mechanisms.
- **Preferences must be honored.** A persisted setting that no code reads is a
  bug; every toggle either drives behavior or is removed.
- **No dead ends.** Every user-visible control routes to a working destination.

---

## Architecture

The changes layer onto the existing Next.js 14 App Router architecture without
altering its shape. The relevant layers and where each phase's work lands:

```
Client (React/TSX)
  ├─ Editor surface (immersive-portal, immersive-toolbar) ...... Req 11, 12, 17, 19
  ├─ Navigation (world-sidebar mobile nav + More sheet) ......... Req 13, 20
  ├─ CTAs & dialogs (waitlist dialog, settings, echoes) ......... Req 14, 15, 16
  └─ Focus-mode Zustand store (persisted prefs) ................. Req 11, 18
        │  reads/writes
        ▼
Middleware (middleware.ts)
  ├─ Security headers + auth IP throttle (existing) ............. reused by Req 8
  └─ NODE_ENV gate for /api/eval/* ............................. Req 9
        │
        ▼
API Route Handlers (app/api/**/route.ts, force-dynamic)
  ├─ requireUser / requireWorldAccess (auth + RBAC) ............. Req 6
  ├─ checkAndIncrement + DAILY_LIMITS (rate limiting) .......... Req 6, 7
  ├─ IP + global throttle (demo chat) .......................... Req 8
  ├─ fail-closed secret + Zod (eval webhook, waitlist) ......... Req 9, 14
  └─ withErrorMonitoring wrapper (Sentry) ...................... Req 10
        │
        ▼
Data / External
  ├─ Supabase Postgres + RLS (replace_entity_tag RPC, waitlist). Req 5, 14
  ├─ Groq (generation) / HuggingFace (embeddings) .............. Req 7, 20
  └─ Inngest (background lore processing) ...................... Req 6
        ▲
Instrumentation (instrumentation.ts register/onRequestError) ... Req 10

Build / Process
  ├─ .gitattributes, .gitignore, package.json ................. Req 1, 2, 3
  ├─ .github/workflows/ci.yml ................................. Req 4
  ├─ .env.example, README, CLAUDE.md/docs, LAUNCH ............. Req 20, 21, 22, 24
  └─ vitest + msw route-handler tests ......................... Req 23
```

The design deliberately introduces **no new architectural layers**. Every server
concern (auth, RBAC, rate limiting, error monitoring) already has a helper; the
work is wiring those helpers into the routes that skipped them and adding one RPC,
one table, and one instrumentation entry point.

**Request flow for a metered, monitored route (e.g. entity merge after Phase 1):**
`middleware` (headers, eval gate) → `withErrorMonitoring` (Sentry context) →
`requireUser` → `requireWorldAccess("editor")` → Zod parse → domain work
(`replace_entity_tag` RPC, relationship/chunk remap, delete) → JSON response;
any throw is caught by the wrapper and reported to Sentry as a safe 500.

## Components and Interfaces

### Server helpers (existing, reused)

| Helper | Location | Signature | Used by |
|--------|----------|-----------|---------|
| `requireUser` | `lib/api.ts` | `() => Promise<{ user, supabase } \| { error }>` | all authed routes |
| `requireWorldAccess` | `lib/world-access.ts` | `(supabase, userId, worldId, role?) => Promise<{ allowed, role }>` | Req 6 import |
| `checkAndIncrement` | `lib/rate-limit.ts` | `(supabase, userId, action, limit) => Promise<{ allowed, count, limit }>` | Req 6, 7 |
| `jsonRateLimited` | `lib/api.ts` | `(action, limit) => NextResponse` (429) | Req 6, 7 |
| `withErrorMonitoring` | `lib/sentry.ts` | `(handler) => handler` | Req 10 |
| `getClientIp` | `lib/middleware/auth-rate-limit.ts` | `(request) => string` | Req 8 |

### New server surfaces

| Surface | Location | Interface |
|---------|----------|-----------|
| `replace_entity_tag` RPC | `supabase/migrations/*` | `(p_world_id uuid, p_old_tag text, p_new_tag text) → void` |
| IP/global limiter | `lib/rate-limit-ip.ts` | `checkIpRateLimit(key, ip, {windowMs, max}) → {allowed, retryAfter}`; `checkGlobalDailyCap(key, max) → {allowed}` |
| Waitlist endpoint | `app/api/waitlist/route.ts` | `POST { email, source? } → 200 \| 400` |
| `instrumentation.ts` | repo root | `register()`, `onRequestError` |
| `waitlist` table | `supabase/migrations/*` | insert-only RLS |

### Client surfaces

| Surface | Location | Change |
|---------|----------|--------|
| `useToolbarVisibility` | `lib/hooks/use-toolbar-visibility.ts` | add `enabled` param (Req 11); add `touchstart` listener (Req 17) |
| `useTypewriterScrolling` | new hook | scroll cursor to center on `selectionUpdate` (Req 11) |
| `ImmersiveToolbar` | `components/lore/immersive-toolbar.tsx` | read `toolbarAutoHide`; theme tokens (Req 11, 19) |
| `ImmersivePortal` | `components/lore/immersive-portal.tsx` | `useReducedMotion()` variant selection (Req 12) |
| `WorldSidebar` mobile nav | `components/layout/world-sidebar.tsx` | 5 + More bottom sheet (Req 13) |
| `WaitlistDialog` | new component | email capture; opened by 5 CTAs (Req 14) |
| `useFocusModeStore` | `lib/stores/focus-mode-store.ts` | remove `soundscape` state (Req 18) |

---

## Phase 0 — Unbreak the Repo

### 1. Line-ending normalization (Req 1)

Add a `.gitattributes` at the repo root:

```gitattributes
* text=auto
*.ts   text eol=lf
*.tsx  text eol=lf
*.css  text eol=lf
*.md   text eol=lf
*.json text eol=lf
*.sql  text eol=lf
```

Procedure:
1. Commit `.gitattributes`.
2. Run `git add --renormalize .` to rewrite the index with LF endings.
3. Commit the renormalization.
4. Set `core.autocrlf=input` locally (documented in README, not enforced in-repo).

Verification: after the renormalization commit, `git diff --ignore-all-space --stat`
returns empty and `git status` shows no line-ending-only churn (the 95-file
phantom diff disappears).

### 2. Root litter removal (Req 2)

Delete: `test-soul.mjs`, `scripts/test-gemini.mjs`, `tsc-output.txt`,
`models.json`, and the `scratch/` directory (3 one-off migration scripts).

Update `.gitignore` to add:

```gitignore
tsc-output.txt
.env
.env.*
!.env.example
```

The `!.env.example` negation keeps the documentation file tracked (Req 21).

### 3. package.json hygiene (Req 3)

- Add `"typecheck": "tsc --noEmit"` to `scripts`.
- Add top-level `"engines": { "node": ">=20" }`.
- Remove `@google/generative-ai` from `dependencies`.
- Confirm `lucide-react` resolves on a clean `npm install` (no version pin change
  expected; just verify).

### 4. Continuous integration (Req 4)

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npx vitest run
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
```

The steps run in sequence; GitHub Actions fails the job on the first non-zero
exit code, satisfying Req 4.4. The Windows-only `eval:service` (`.venv\Scripts\python.exe`)
and `eval:setup` (PowerShell) scripts are never invoked by this workflow (Req 4.3).
`next build` needs public Supabase env vars present at build time, so placeholders
are supplied.

---

## Phase 1 — Bugs, Cost Holes, Monitoring

### 5. Entity merge tag remap via RPC (Req 5)

**Root cause:** `Merge_Handler` (`app/api/entities/merge/route.ts:110-114`) calls
`supabase.rpc("replace_entity_tag", …)` but no migration ever created that
function. `supabase-js` returns the error inside the resolved `{ error }` object;
the trailing `.then(() => {})` swallows it, so every merge silently leaves stale
tags on `lore_chunks.entity_tags`.

`entity_tags` is a `text[]` column on `lore_chunks` holding entity **names** (the
working JS port in the dead `[id]/merge` route confirms this — it does
`.contains("entity_tags", [source.name])` and maps `tag === source.name ? target.name : tag`).

**Migration** — create `supabase/migrations/<timestamp>_replace_entity_tag.sql`:

```sql
-- Remaps a text tag across all lore_chunks in a world: replaces every
-- occurrence of p_old_tag with p_new_tag inside the entity_tags text[] array,
-- de-duplicating so p_new_tag never appears twice in the same row.
create or replace function replace_entity_tag(
  p_world_id uuid,
  p_old_tag  text,
  p_new_tag  text
) returns void
language sql
security invoker
as $$
  update lore_chunks
  set entity_tags = (
    select array_agg(distinct t)
    from unnest(
      array_replace(entity_tags, p_old_tag, p_new_tag)
    ) as t
  )
  where world_id = p_world_id
    and entity_tags @> array[p_old_tag];
$$;
```

Notes:
- `security invoker` keeps RLS in force under the caller's session (the handler
  uses the user-scoped client, not the admin client).
- `array_replace` swaps the name in place; wrapping in `array_agg(distinct …)`
  collapses the case where the target name was already present, preventing
  duplicate tags.
- The `@>` guard keeps the update scoped to affected rows only.

**Handler signature** (unchanged call site, but the result is now checked):

```ts
if (secondaryName !== primaryName) {
  const { error: tagError } = await supabase.rpc("replace_entity_tag", {
    p_world_id: worldId,
    p_old_tag: secondaryName,
    p_new_tag: primaryName,
  });
  if (tagError) {
    return jsonError("TAG_REMAP_FAILED", 500, { detail: tagError.message });
  }
}
```

This replaces the fire-and-forget `.then(() => {})` (Req 5.2, 5.3). Because the
remap now happens before the secondary entity is deleted, all source-entity tags
end up associated with the target (Req 5.4).

**Cleanup:** delete `app/api/entities/[id]/merge/route.ts` (Req 5.5) — its JS
tag-remap logic is superseded by the RPC and the canonical route is
`app/api/entities/merge/route.ts`.

**Test** (Req 5.6): a route-handler test seeds two entities with overlapping and
distinct tags on `lore_chunks`, invokes the merge handler, and asserts the target
entity's name appears on the previously source-tagged chunks and the source name
is gone. See Phase 3 test strategy for the msw/mock approach.

### 6. World import metering and access (Req 6)

**Root cause:** `Import_Handler` (`app/api/worlds/[id]/import/route.ts`) does a raw
`world.user_id !== user.id` check and inserts up to 10 entries + fires 10 Inngest
events with **no** `checkAndIncrement` and no free-tier cap — fully bypassing the
`lore_ingest` 10/day limit and the 50-entries/world cap.

Changes:

1. **Access guard** — replace the ownership check with the shared helper so
   collaborators with the `editor` role can import (Req 6.3):

   ```ts
   const access = await requireWorldAccess(supabase, user.id, params.id, "editor");
   if (!access.allowed) return jsonError("Forbidden", 403);
   ```

2. **Free-tier cap** — before importing, count existing entries and reject if the
   batch would exceed `FREE_TIER_LIMITS.loreEntries` (50) (Req 6.2):

   ```ts
   const { count: existing } = await supabase
     .from("lore_entries")
     .select("id", { count: "exact", head: true })
     .eq("world_id", params.id);
   if ((existing ?? 0) + validFiles.length > FREE_TIER_LIMITS.loreEntries) {
     return jsonError("FREE_TIER_LORE_LIMIT", 403, {
       limit: FREE_TIER_LIMITS.loreEntries,
     });
   }
   ```

3. **Per-entry rate limiting** — count each imported entry against `lore_ingest`
   through `checkAndIncrement`. Call it once per successful insert; the first
   call that returns `allowed: false` stops the loop and returns a rate-limit
   response (Req 6.1, 6.4):

   ```ts
   const gate = await checkAndIncrement(supabase, user.id, "lore_ingest", DAILY_LIMITS.lore_ingest);
   if (!gate.allowed) {
     // stop importing further files; report what was imported so far
     return jsonRateLimited("lore_ingest", DAILY_LIMITS.lore_ingest);
   }
   ```

   Placement: inside the per-file loop, immediately before the `lore_entries`
   insert, so files are metered 1:1 and an exhausted budget short-circuits the
   remaining files. Files that fail validation (bad extension, oversize, empty)
   are not counted.

Because `checkAndIncrement` fails closed (`allowed: false` when the limiter RPC
errors), an unavailable limiter blocks imports rather than leaking free spend.

### 7. Autocomplete rate limiting (Req 7)

Add a new limit to `DAILY_LIMITS` in `lib/constants.ts`:

```ts
export const DAILY_LIMITS = {
  chat_message: 5,
  lore_ingest: 10,
  autocomplete: 30, // NEW — bounds per-user Groq autocomplete spend
  consistency_check: 5,
  // …unchanged
} as const;
```

Because `UsageMeter["action"]` and the dashboard usage meters derive from
`DAILY_LIMITS` keys, adding this key automatically surfaces an `autocomplete`
usage meter — no other type changes needed.

In `Autocomplete_Handler`, after auth and before generation:

```ts
const { supabase, user } = auth;
const gate = await checkAndIncrement(supabase, user.id, "autocomplete", DAILY_LIMITS.autocomplete);
if (!gate.allowed) return jsonRateLimited("autocomplete", DAILY_LIMITS.autocomplete);
```

(Req 7.1–7.3.)

**Error-copy fix (Req 7.4, 7.5):** the handler's `AI_NOT_CONFIGURED` detail
currently reads "Missing GEMINI_API_KEY". Generation runs on Groq; embeddings on
HuggingFace. Replace with provider-accurate copy, e.g.:

```ts
return jsonError("AI_NOT_CONFIGURED", 503, {
  detail: "Missing GROQ_API_KEY on the server (generation uses Groq; embeddings use HuggingFace).",
});
```

Apply the same correction in `consistency/check`, `narrator`, and `demo/chat`
route handlers (the `demo/chat` handler currently says "Missing GROQ_API_KEY or
GEMINI_API_KEY" — drop the Gemini reference).

### 8. Demo chat throttling (Req 8)

`Demo_Chat_Handler` is public/unauthenticated by design, so it can't use the
per-user `checkAndIncrement`. Reuse the middleware IP pattern instead.

Generalize the existing in-memory limiter (`lib/middleware/auth-rate-limit.ts`)
into a small reusable helper or add a sibling module `lib/rate-limit-ip.ts` that
exposes a configurable window/limit while keeping the same sliding-window Map
design. Then in the handler:

```ts
import { getClientIp } from "@/lib/middleware/auth-rate-limit";
import { checkIpRateLimit, checkGlobalDailyCap } from "@/lib/rate-limit-ip";

const ip = getClientIp(request);
const perIp = checkIpRateLimit("demo_chat", ip, { windowMs: 60_000, max: 8 });
if (!perIp.allowed) {
  return jsonError("RATE_LIMITED", 429, { retryAfter: perIp.retryAfter });
}
const global = checkGlobalDailyCap("demo_chat", 5_000); // circuit breaker
if (!global.allowed) {
  return jsonError("DEMO_UNAVAILABLE", 429);
}
```

- **Per-IP throttle** (Req 8.1): same sliding-window design as `checkAuthRateLimit`,
  keyed by `"demo_chat:" + ip`.
- **Global daily cap** (Req 8.2): a process-level counter reset at UTC midnight that
  acts as a hard circuit breaker regardless of source IP.
- Either limit exceeded ⇒ reject before calling Groq (Req 8.3).

Caveat documented in code: the in-memory store is per-serverless-isolate and
resets on cold start (same limitation the auth limiter already accepts); it
raises the cost of scripted abuse without a shared store. A Redis/Upstash-backed
store is noted as a post-launch hardening option.

### 9. Eval webhook fail-closed auth (Req 9)

Two changes:

1. **Fail closed in the handler** (`Eval_Webhook_Handler`). Replace the
   `if (webhookSecret) { … }` guard so an unset secret rejects rather than skips:

   ```ts
   const webhookSecret = process.env.EVAL_WEBHOOK_SECRET ?? "";
   if (!webhookSecret) return jsonError("Webhook not configured", 503);
   const incoming = request.headers.get("x-eval-webhook-secret") ?? "";
   if (incoming !== webhookSecret) return jsonError("Forbidden", 403);
   ```

   (Req 9.1, 9.3.)

2. **NODE_ENV gate for all `/api/eval/*` routes** (Req 9.2). The eval *page* is
   already dev-gated but the API routes are not. Add a guard in `middleware.ts`
   (which already runs on all paths via its matcher) that rejects eval API traffic
   outside development:

   ```ts
   if (
     request.nextUrl.pathname.startsWith("/api/eval") &&
     process.env.NODE_ENV !== "development"
   ) {
     const res = NextResponse.json({ error: "Not found" }, { status: 404 });
     applySecurityHeaders(res);
     return res;
   }
   ```

   Placed near the top of `middleware`, before session refresh, so no eval route
   is reachable in production. Returning 404 avoids advertising the endpoint.

### 10. Backend Sentry monitoring (Req 10)

**Root cause:** `@sentry/nextjs` v10 loads server/edge configs via
`instrumentation.ts` `register()`; that file doesn't exist, so
`sentry.server.config.ts` / `sentry.edge.config.ts` never run. `withErrorMonitoring`
exists in `lib/sentry.ts` but is imported by zero routes.

1. **Create `instrumentation.ts`** at the repo root:

   ```ts
   export async function register() {
     if (process.env.NEXT_RUNTIME === "nodejs") {
       await import("./sentry.server.config");
     }
     if (process.env.NEXT_RUNTIME === "edge") {
       await import("./sentry.edge.config");
     }
   }

   export { captureRequestError as onRequestError } from "@sentry/nextjs";
   ```

   `register()` runtime-switches config loading (Req 10.1); `onRequestError` is
   re-exported from Sentry's helper so nested React Server Component errors are
   captured (Req 10.2).

2. **Wrap the 8 highest-risk routes** with `withErrorMonitoring` (Req 10.3):
   `souls/chat`, `souls/generate`, `lore/ingest`, `consistency/check`, `narrator`,
   `tavern`, `entities/merge`, and `worlds/[id]/export`.

   `withErrorMonitoring` has signature `(handler: (req: Request) => Promise<Response>) => (req) => Promise<Response>`.
   For routes with the `(request, { params })` context object it must be adapted,
   since the current signature only passes `req`. Two options; the design chooses
   **(b)**:

   - (a) broaden `withErrorMonitoring` to a generic `(...args)` passthrough, or
   - (b) wrap only the request-processing body for dynamic routes, keeping
     `params` in closure:

   ```ts
   export async function POST(request: Request, ctx: { params: { id: string } }) {
     return withErrorMonitoring(async (req) => {
       // …existing body, using ctx.params.id…
     })(request);
   }
   ```

   For static routes (`souls/chat`, etc.) the wrap is direct:
   `export const POST = withErrorMonitoring(async (request) => { … });`

3. When a wrapped handler throws, `withErrorMonitoring` calls `captureApiError`,
   which sets route/world context, calls `Sentry.captureException`, and returns a
   safe 500 (Req 10.4). Verified by the launch checklist's "throw reaches Sentry"
   step.

### 11. Settings toggles wired (Req 11)

**`toolbarAutoHide`** — `Immersive_Toolbar` currently hardcodes
`useToolbarVisibility(3000)`. Read the preference from `Focus_Mode_Store` and pass
an effective timeout; when disabled, pass a sentinel that keeps the toolbar
pinned.

Extend `useToolbarVisibility` to accept a disable case:

```ts
export function useToolbarVisibility(timeoutMs = 3000, enabled = true) {
  // when !enabled: setIsVisible(true), never schedule the hide timer
}
```

In `immersive-toolbar.tsx`:

```ts
const toolbarAutoHide = useFocusModeStore((s) => s.toolbarAutoHide);
const { isVisible, resetTimer } = useToolbarVisibility(3000, toolbarAutoHide);
```

When `toolbarAutoHide` is true the toolbar hides after 3s of inactivity (Req 11.1);
when false it stays visible (Req 11.2).

**`typewriterScrolling`** — implement it (per clarifying decision, not delete).
Add a small hook used by the editor that, on TipTap `selectionUpdate`, scrolls the
cursor line to vertical center when the preference is on:

```ts
export function useTypewriterScrolling(editor: Editor | null, enabled: boolean) {
  useEffect(() => {
    if (!editor || !enabled) return;
    const onSelUpdate = () => {
      const { node } = editor.view.domAtPos(editor.state.selection.head);
      const el = (node instanceof HTMLElement ? node : node.parentElement);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    editor.on("selectionUpdate", onSelUpdate);
    return () => { editor.off("selectionUpdate", onSelUpdate); };
  }, [editor, enabled]);
}
```

Wired in the immersive editor with `enabled = useFocusModeStore(s => s.typewriterScrolling)`
(Req 11.3). When disabled the effect is inert and scroll position is untouched
(Req 11.4). Both preferences remain in `Focus_Mode_Store` (Req 11.5); note the
separate `soundscape` dead-state removal is Req 18.2.

### 12. Reduced-motion on immersive entry (Req 12)

**Root cause:** `Immersive_Portal` stores the reduced-motion match in a `useRef`
inside `useEffect`, but variant selection happens at render time before the effect
runs and never re-renders on change — so entry always plays the full blur+scale.

Replace with framer-motion's reactive hook:

```ts
import { useReducedMotion } from "framer-motion";
// …
const prefersReduced = useReducedMotion();
const variants = prefersReduced ? reducedMotionVariants : portalVariants;
```

`useReducedMotion` reads the media query at render time and is reactive to changes
(Req 12.1, 12.2). Delete the `reducedMotionRef` + its `useEffect`.

---

## Phase 2 — UX Dead Ends, Dead Code, Theme

### 13. Mobile navigation completeness (Req 13)

**Root cause:** `World_Sidebar` mobile nav renders `items.slice(0, 5)` — the
Tavern and Narrator's Tools sections (indices 5–6) are unreachable on mobile.

Port the bottom-sheet pattern from `aether-dock.tsx` (which already implements a
polished More sheet: backdrop + `AnimatePresence` sheet + 3-column grid + drag
handle) into `World_Sidebar` before deleting AetherDock (Req 13.4, 13.5).

Design:
- Render the first five `items` directly (unchanged) plus a sixth "More" button
  in the mobile bar (Req 13.2).
- Tapping More toggles `moreSheetOpen` state and renders a bottom sheet listing
  the remaining sections (`items.slice(5)` → Tavern, Narrator's Tools) using the
  ported markup and the existing `nextHref`/`router.push` navigation (Req 13.1, 13.3).
- The sheet uses theme tokens (`var(--surface-raised)`, `color-mix(... var(--bg) ...)`)
  consistent with AetherDock, so it also satisfies the theme rule.

After the port and verification, delete `components/aether/aether-dock.tsx`
(Req 13.5) — it has zero other importers.

### 14. Upgrade CTAs to waitlist (Req 14)

Per clarifying decision, the five Upgrade CTAs point at a **waitlist email
capture**, not a hidden billing flag.

**Storage destination:** a new `waitlist` table in Supabase with an insert-only
RLS policy (anon + authenticated may insert; no select). Migration:

```sql
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text,               -- which CTA drove the signup
  created_at timestamptz not null default now(),
  unique (email)
);
alter table waitlist enable row level security;
create policy "anyone can join waitlist" on waitlist
  for insert to anon, authenticated with check (true);
```

**Endpoint:** `POST /api/waitlist` (`force-dynamic`) validates with Zod
(`z.object({ email: z.string().email(), source: z.string().max(64).optional() })`),
returns 400 on invalid email (Req 14.3), and upserts on the `email` unique
constraint so repeat submissions succeed idempotently (Req 14.1, 14.2). It records
the submitted address in the `waitlist` table.

**UI:** a small `WaitlistDialog` component with an email field and inline
validation message. All five `Upgrade_CTA` sites —
`world-settings-drawer.tsx:349`, `user-nav.tsx:58`, `rate-limit-modal.tsx:114`,
and `tavern-chat.tsx:78,290` — open this dialog instead of navigating to
`/dashboard/settings#billing` (Req 14.4, 14.5). Remove every
`/dashboard/settings#billing` link target.

### 15. Remove "coming soon" soul-chat buttons (Req 15)

In `Echoes_Interface` (`components/souls/echoes-interface.tsx:488,496`), remove
the Bookmark and Inspire buttons whose handlers call `toast.info("Coming soon.")`,
along with any now-unused imports/handlers (Req 15.1, 15.2). No replacement.

### 16. Account deletion compliance path (Req 16)

In `Account_Settings` (`components/settings/settings-content.tsx:139-145`),
replace the permanently disabled "coming soon" button with a clear instruction and
mailto affordance:

> To delete your account, email `support@grimoire.pro` and we'll remove your data.

Rendered as an actionable `mailto:support@grimoire.pro` link (Req 16.1).

Document the manual deletion cascade in `Docs` (Req 16.2): the root records are
`profiles` and `worlds`; deleting a `profiles` row and the user's `worlds` rows
cascades to worlds' children (lore, entities, chunks, souls, members) via the
existing `ON DELETE CASCADE` foreign keys. The doc lists the roots and the manual
Supabase steps.

### 17. Toolbar touch recovery (Req 17)

Add `touchstart` to the `useToolbarVisibility` activity listeners so hidden
toolbars can be re-summoned on touch devices:

```ts
window.addEventListener("touchstart", onActivity, { passive: true });
// …and remove it in cleanup
```

`onActivity` already calls `resetTimer`, which sets `isVisible = true` (Req 17.1,
17.2).

### 18. Dead code removal (Req 18)

Delete the 10 zero-importer modules (Req 18.1):
`components/lore/lore-editor.tsx`, `components/souls/soul-chat-interface.tsx`,
`components/dashboard/account-settings-panel.tsx`,
`components/dashboard/world-card.tsx`,
`components/landing/social-proof-strip.tsx` (contains fabricated stats — priority
removal), `components/bible/entity-grid.tsx`,
`components/layout/world-right-panel.tsx`,
`components/lore/lore-search-panel.tsx`,
`components/shared/ambient-particles.tsx`, and `lib/gemini.ts`.

Remove the `soundscape` dead state from `Focus_Mode_Store` (Req 18.2): the
`Soundscape` type, `soundscape` field, `setSoundscape` action, `VALID_SOUNDSCAPES`,
`isValidSoundscape`, its default, and its validation branch. (This is independent
of the `typewriterScrolling`/`toolbarAutoHide` preferences kept in Req 11.5.)

Verification: `next build` succeeds after deletion (Req 18.3) — proves nothing
imported them. `aether-dock.tsx` is deleted in Req 13.5, not here.

### 19. Theme-discipline and sitemap (Req 19)

- **`immersive-toolbar.tsx`** (Req 19.1): replace `bg-black/60` →
  `bg-[color-mix(in_srgb,var(--bg)_60%,transparent)]`, `border-white/10` →
  `border-[var(--border)]`, and the five `bg-white/15` / `hover:bg-white/10`
  usages → token-based (`bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)]`,
  active state to `var(--accent)` mix).
- **`tavern-chat.tsx`** (Req 19.2): replace the four `text-white` utilities with
  `text-[var(--text-main)]`.
- **Modal scrims** (Req 19.3): normalize the ~9 `bg-black/40`–`bg-black/60` scrims
  to `bg-[color-mix(in_srgb,var(--bg)_60%,transparent)]`, matching the established
  pattern used by AetherDock.
- **Sitemap** (Req 19.4): add `/privacy` and `/terms` entries to `app/sitemap.ts`.

---

## Phase 3 — Docs, Tests, Launch

### 20. Documentation rewrite (Req 20)

Rewrite `CLAUDE.md` (optionally split into `docs/`) to correct the record:

- **Embeddings** run on HuggingFace `sentence-transformers/all-mpnet-base-v2` via
  `lib/embedding/service.ts`, using `HF_TOKEN`, `EMBEDDING_FALLBACK_TOKEN`,
  `EMBEDDING_FALLBACK_MODEL` (Req 20.1). Generation runs on Groq.
- Remove all `GEMINI_API_KEY` references and the false `@anthropic-ai/sdk`
  dependency claim (Req 20.2).
- Document shipped-but-undocumented features: world collaboration
  (members/invitations + RLS), world import, onboarding state, immersive writing
  mode, and the settings refactor (Req 20.3).
- State that manual entity creation exists via `POST /api/entities` (Req 20.4).
- Remove AetherDock mobile-nav claims; describe the live `World_Sidebar` mobile
  nav with the 5 + More sheet (Req 20.5).
- Document the live env vars including HuggingFace, Sentry, PostHog, and fallback
  variables (Req 20.6).

### 21. Environment example file (Req 21)

Create a root `.env.example` listing every live variable with a comment. Derived
from `lib/env.ts`, `lib/public-env.ts`, Sentry, and PostHog usage:

```dotenv
# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only; bypasses RLS (eval webhook, admin)

# ── Generation (Groq) ──
GROQ_API_KEY=                       # required for all LLM generation

# ── Embeddings (HuggingFace) ──
HF_TOKEN=                           # optional but recommended (removes anon rate limits)
EMBEDDING_FALLBACK_TOKEN=           # optional fallback provider token
EMBEDDING_FALLBACK_MODEL=           # optional fallback model id

# ── Inngest ──
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# ── Monitoring ──
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=            # optional; PostHog no-ops when unset
NEXT_PUBLIC_POSTHOG_HOST=

# ── Eval (dev-only) ──
EVAL_WEBHOOK_SECRET=                # required for the eval webhook to accept writes
```

`.env.example` is kept out of the `.env*` gitignore via the `!.env.example`
negation from Phase 0 (Req 21.1, 21.2).

### 22. README rewrite (Req 22)

Replace the create-next-app boilerplate `README.md` with project content
(Req 22.1, 22.2): stack overview (Next 14 App Router, Supabase, Inngest, Groq,
HuggingFace, TypeScript); setup (create Supabase project + run migrations, set up
Inngest, copy `.env.example`); dev commands (`dev`, `lint`, `typecheck`,
`vitest run`, `build`); and deploy notes (Vercel + `.vercelignore` sidecar
exclusion, `core.autocrlf=input` guidance).

### 23. Route-handler tests (Req 23)

Test the five endpoints changed in Phase 1: **merge, import, autocomplete,
demo-chat, eval-webhook** (Req 23.1).

**Framework:** vitest (already installed) + **msw** for mocking outbound HTTP
(Groq, HuggingFace, Inngest). Supabase is mocked with a hand-rolled chainable stub
returned from a `createServerSupabaseClient` mock, since the handlers use the
fluent query builder and RPC calls rather than raw HTTP. Pattern:

```ts
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => makeSupabaseStub(seed),
}));
```

Per-endpoint coverage:
- **merge**: seed two entities + tagged chunks; assert `replace_entity_tag` RPC is
  invoked and, given a stub that applies the remap, the target name replaces the
  source name; assert a 500 when the RPC stub returns an error.
- **import**: assert `requireWorldAccess("editor")` gating (403 for non-editor),
  the 50-entry cap rejection, and `checkAndIncrement` short-circuit (429).
- **autocomplete**: assert 429 when `checkAndIncrement` returns `allowed: false`,
  and provider-accurate error copy when AI env is absent.
- **demo-chat**: assert per-IP throttle and global-cap 429s using a reset store;
  msw mocks the Groq stream.
- **eval-webhook**: assert 503 when `EVAL_WEBHOOK_SECRET` unset, 403 on mismatch,
  and success on match.

**Directory hygiene** (Req 23.2): remove the empty `tests/integration`,
`tests/ui`, `tests/unit` scaffold directories (or populate them). Route-handler
tests live alongside routes or under a `tests/routes` dir. `vitest run` passes
(Req 23.3).

### 24. Launch checklist (Req 24)

Add a launch checklist to `Docs` (e.g. `docs/LAUNCH.md` or a README section):

1. **Migrations** — run all `supabase/migrations/*` against production Supabase,
   including the new `replace_entity_tag` and `waitlist` migrations (Req 24.1).
2. **Production env** — set `INNGEST_EVENT_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, the
   PostHog key, `GROQ_API_KEY`, `HF_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, and
   confirm `EVAL_WEBHOOK_SECRET` is set (or accept that eval is dev-gated off)
   (Req 24.1).
3. **`.vercelignore`** — confirm it excludes the Python eval sidecar (Req 24.1).
4. **Smoke test** on the deployed URL: signup → create world → inscribe lore →
   forge soul → chat → tavern → export (Req 24.2).
5. **Observability** — trigger a route error and confirm it lands in Sentry;
   exhaust a limit and confirm the rate-limit modal fires (Req 24.3).

---

## Data Models

### `replace_entity_tag(p_world_id uuid, p_old_tag text, p_new_tag text) → void`
Postgres function; remaps `lore_chunks.entity_tags` (a `text[]` of entity names)
within one world, de-duplicating. `security invoker` so RLS applies.

### `waitlist` table
`id uuid pk`, `email text unique not null`, `source text`, `created_at timestamptz`.
Insert-only RLS for `anon`/`authenticated`; no read policy.

### `DAILY_LIMITS.autocomplete = 30`
New key in the existing const map; auto-propagates to `UsageMeter["action"]` and
the dashboard usage meters.

---

## Error Handling

- **Rate limits / caps** — return `jsonRateLimited(action, limit)` (429) or a
  `403` with a `limit` field for the free-tier cap. `checkAndIncrement` fails
  closed on limiter errors.
- **Access** — `requireWorldAccess(..., "editor")` → `403 Forbidden` when denied.
- **RPC failure (merge)** — surface as `500 TAG_REMAP_FAILED` instead of silent
  success.
- **Eval webhook** — `503` when secret unset, `403` on mismatch, `404` for eval
  routes outside development.
- **Unhandled route errors** — `withErrorMonitoring` → Sentry capture + safe 500
  with no stack leakage.
- **Waitlist** — invalid email → `400 VALIDATION_ERROR`; duplicate email →
  idempotent success via upsert.

---

## Testing Strategy

**Dual approach.** Route-handler tests (Req 23) are the primary safety net for the
Phase 1 changes; these are example/integration-style because the handlers are I/O
orchestrators over Supabase and external LLM APIs, not pure functions — behavior
does not vary meaningfully across 100 random inputs, so example-based tests with
mocks are the right tool (see property analysis below).

**Where property tests add value.** The two pieces of genuinely input-varying pure
logic are the `replace_entity_tag` remap semantics (tag-array transformation) and
email validation. These are candidates for fast-check property tests
(already installed) and are captured as correctness properties below.

- Property tests: ≥100 iterations, tagged `Feature: ship-plan-v1, Property {n}: {text}`.
- Unit/route tests: mock Supabase + msw for outbound HTTP; assert status codes,
  gating, and error copy.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — a formal statement about what the system should do.
Properties bridge human-readable specifications and machine-verifiable correctness
guarantees.*

Most of this feature's acceptance criteria are configuration, filesystem, or
structural-wiring outcomes (verified by smoke checks and static assertions) or
discrete control-flow branches (verified by example-based route-handler tests).
Three criteria expose genuinely input-varying pure logic and are captured as
universally quantified properties below.

### Property 1: Entity-tag remap moves all source tags to the target

For any `entity_tags` array (any mix of the source name, the target name, and
unrelated tags, in any order, with or without duplicates), applying the
`replace_entity_tag` remap of `oldTag → newTag` produces an array in which the
source name never appears, the target name appears if and only if the source name
or the target name was present before, every unrelated tag is preserved, and no
tag appears more than once.

**Validates: Requirements 5.4**

### Property 2: IP and global rate limits never allow more than their maximum

For any sequence of demo-chat requests from a single IP within one window, the
number of requests reported as allowed never exceeds the configured per-IP
maximum; and for any sequence of requests across all IPs within one day, once the
global daily cap has been reached every subsequent request is rejected.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 3: Waitlist accepts an email if and only if it is validly formatted

For any candidate string, the waitlist submission validator accepts the
submission if and only if the string is a valid email address; every
invalid-format string is rejected with a validation response and every
valid-format string is accepted.

**Validates: Requirements 14.1, 14.3**
