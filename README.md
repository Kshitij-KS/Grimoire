# Grimoire

A dark-fantasy worldbuilding SaaS for fiction writers and game masters. Writers pour lore
into an enchanted editor; Grimoire turns it into structured, searchable memory (vector
embeddings + extracted entities) and lets you forge characters into AI personas that speak
in their own voices — grounded in your world's lore.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Supabase** — PostgreSQL + pgvector (768-dim) + Auth + Row Level Security
- **Inngest** — background lore processing (chunk → embed → extract entities), with a
  synchronous SSE fallback
- **Groq** — all LLM text generation (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`)
- **HuggingFace** — vector embeddings (`sentence-transformers/all-mpnet-base-v2`) via a
  hardened embedding service with retry/backoff and a configurable fallback provider
- **Tailwind CSS** + shadcn/ui + Framer Motion, **TipTap** editor, **Zustand** state,
  **React Hook Form** + **Zod**
- **Sentry** + **PostHog** for monitoring/analytics (both optional)

> Generation is Groq; embeddings are HuggingFace. There is no Gemini or Anthropic
> integration.

## Prerequisites

- Node.js **>= 20**
- A Supabase project
- A Groq API key (and, optionally, a HuggingFace token)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy the example env file and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   At minimum set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `GROQ_API_KEY`. See `.env.example` for the full,
   commented list (HuggingFace, Inngest, Sentry, PostHog, eval).

3. **Set up Supabase**

   Create a Supabase project, then apply the migrations in `supabase/migrations/` (in
   filename order) to your database. You can run them via the Supabase SQL editor or the
   Supabase CLI (`supabase db push`). This creates all tables, RLS policies, and RPCs
   (`match_lore_chunks`, `match_semantic_cache`, `replace_entity_tag`, etc.) and enables
   the `pgvector` extension used by the 768-dim embedding columns.

4. **Set up Inngest (for background lore processing)**

   For local development, run the Inngest dev server alongside `npm run dev`:

   ```bash
   npx inngest-cli@latest dev
   ```

   It runs on http://localhost:8288 and auto-discovers the app's functions at
   `/api/inngest`. Use `INNGEST_EVENT_KEY=test` and `INNGEST_SIGNING_KEY=test` locally;
   use real keys from app.inngest.com in production. If Inngest is unavailable, lore
   ingestion falls back to a synchronous SSE path.

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Development Commands

```bash
npm run dev          # Start the Next.js dev server (http://localhost:3000)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Run the test suite (vitest run)
npm run build        # Production build (must pass with 0 errors)
```

Tests use **Vitest** (with **msw** for outbound HTTP and a chainable Supabase stub for
route-handler tests). `npm run test:watch` runs Vitest in watch mode.

## Deployment

Grimoire deploys to **Vercel**.

- Set all production environment variables in the Vercel project settings (see
  `.env.example`), including real `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`,
  `NEXT_PUBLIC_SENTRY_DSN`, and the PostHog key. `next build` needs the public Supabase
  vars present at build time.
- **`.vercelignore`** excludes the Python eval sidecar (`scripts/eval-service/`) and local
  `supabase/migrations/` from the deployment bundle — the eval service is a dev-only tool
  and never ships. The `eval:service` / `eval:setup` npm scripts are Windows-only and are
  never run in CI or on Vercel; the `/api/eval/*` routes are rejected outside
  `NODE_ENV=development`.
- Apply any new migrations to your production Supabase database before deploying code that
  depends on them.

### Line endings

The repo enforces LF line endings via `.gitattributes`. On Windows, configure Git to check
out with LF so you don't introduce CRLF churn:

```bash
git config core.autocrlf input
```

## Project Layout

- `app/` — Next.js App Router routes and API route handlers (`app/api/**/route.ts`)
- `components/` — React components grouped by feature
- `lib/` — server/client helpers, AI clients, stores, hooks, constants
- `supabase/migrations/` — SQL migrations (schema, RLS, RPCs)
- `tests/` — Vitest tests
- `CLAUDE.md` — the project bible: full feature, architecture, and env reference

For a deeper tour of features, architecture, rate limits, the design system, and the
account-deletion cascade, see **[CLAUDE.md](./CLAUDE.md)**.
