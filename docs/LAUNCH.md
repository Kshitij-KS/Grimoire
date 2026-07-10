# Launch Checklist — Grimoire v1

A verifiable, ordered checklist for shipping Grimoire to production. Work top to
bottom: database first, then environment, then deploy config, then a smoke test
on the live URL, and finally observability verification.

> Legend: `[ ]` = not done, `[x]` = done. Check each box as you complete it.

---

## 1. Database migrations (production Supabase)

Run **every** migration in `supabase/migrations/` against the production Supabase
project, in filename (timestamp) order. Apply via the Supabase SQL editor or the
Supabase CLI (`supabase db push`).

- [ ] All existing migrations in `supabase/migrations/` are applied in timestamp order.
- [ ] `20260623000100_replace_entity_tag.sql` is applied — creates the
      `replace_entity_tag(p_world_id, p_old_tag, p_new_tag)` RPC used by the entity
      merge handler. Without it, merges silently leave stale entity tags.
- [ ] `20260624000100_waitlist.sql` is applied — creates the insert-only `waitlist`
      table backing the Upgrade CTAs.
- [ ] Verify both new objects exist in production:
  - [ ] `select proname from pg_proc where proname = 'replace_entity_tag';` returns a row.
  - [ ] `select to_regclass('public.waitlist');` is non-null.

---

## 2. Production environment variables

Set these in the production environment (e.g. Vercel Project Settings →
Environment Variables). See `.env.example` for the full annotated list. Keep all
secrets out of `NEXT_PUBLIC_*` variables.

### Required

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (browser-safe).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (browser-safe).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — server-only; used by the Inngest worker and eval webhook. Bypasses RLS — never expose to the browser.
- [ ] `GROQ_API_KEY` — all LLM text generation runs on Groq.
- [ ] `INNGEST_EVENT_KEY` — production Inngest event key (from app.inngest.com).
- [ ] `INNGEST_SIGNING_KEY` — production Inngest signing key.
- [ ] `EVAL_WEBHOOK_SECRET` — the eval webhook fails closed (503) when unset.

### Recommended / optional

- [ ] `HF_TOKEN` — HuggingFace token for embeddings; removes anonymous rate limits.
- [ ] `NEXT_PUBLIC_SENTRY_DSN` — Sentry DSN; Sentry is disabled when unset.
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` — PostHog project key; PostHog no-ops when unset.
- [ ] `NEXT_PUBLIC_POSTHOG_HOST` — defaults to `https://us.i.posthog.com` when unset.
- [ ] `EMBEDDING_FALLBACK_TOKEN` / `EMBEDDING_FALLBACK_MODEL` — only used if both are set.

---

## 3. Deploy configuration

- [ ] Confirm `.vercelignore` excludes the Python eval sidecar so it is not bundled
      into the deployment. Current `.vercelignore` contents:

  ```
  # Ignore Python sidecar during Vercel deployment
  scripts/eval-service/

  # Ignore Supabase local migrations
  supabase/migrations/
  ```

  Both `scripts/eval-service/` (the Python eval sidecar) and
  `supabase/migrations/` are excluded — the sidecar is dev/eval-only and
  migrations are applied directly against Supabase (section 1), not shipped with
  the app.
- [ ] Confirm `/api/eval/*` routes are unreachable in production (middleware gates
      them to `NODE_ENV=development` and returns 404 otherwise).

---

## 4. Smoke test (deployed URL)

Run the full happy path against the live production URL with a fresh account:

- [ ] **Signup** — create a new account and confirm you land in the dashboard.
- [ ] **Create world** — create a new world.
- [ ] **Inscribe lore** — add a lore entry and confirm background processing
      completes (chunks + embeddings appear; Inngest worker runs).
- [ ] **Forge soul** — generate a soul from the world's lore.
- [ ] **Chat** — hold a chat conversation with the forged soul.
- [ ] **Tavern** — open the tavern and exchange at least one message.
- [ ] **Export** — export the world and confirm the download succeeds.

---

## 5. Observability verification

- [ ] **Sentry — route error reaches Sentry.** Trigger a route error (e.g. hit a
      monitored endpoint in a failing state) and confirm the exception appears in
      the Sentry project with route/world context attached. This proves
      `instrumentation.ts` loaded the server config and `withErrorMonitoring`
      is wired.
- [ ] **Rate-limit modal fires.** Exhaust a per-user daily limit (e.g. send more
      than the `chat_message` daily allowance) and confirm the client shows the
      rate-limit modal and the endpoint returns 429.
- [ ] (If enabled) **PostHog** — confirm events are arriving in the PostHog
      project after the smoke test.

---

## Sign-off

- [ ] All sections above are complete.
- [ ] `npm run lint`, `npm run typecheck`, `npx vitest run`, and `npm run build`
      are green on the shipped commit.
