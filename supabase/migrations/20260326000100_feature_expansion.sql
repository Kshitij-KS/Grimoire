-- ============================================================================
-- Grimoire Feature Expansion Migration
-- Adds: failed_jobs, semantic_cache, lore_folders, entity_relationships,
--        tavern_sessions, tavern_messages
-- Alters: lore_entries (folder_id), messages (source_chunk_ids)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. FAILED JOBS — Dead-letter queue for Inngest retries
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists failed_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  world_id uuid references worlds(id) on delete cascade,
  event_name text not null,
  payload jsonb not null default '{}',
  error_message text,
  retry_count integer default 0,
  max_retries integer default 3,
  status text default 'failed' check (status in ('failed', 'retrying', 'resolved')),
  lore_entry_id uuid references lore_entries(id) on delete set null,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. SEMANTIC CACHE — pgvector cache for soul chat responses
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists semantic_cache (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  soul_id uuid references souls(id) on delete cascade,
  prompt_hash text not null,
  prompt_text text not null,
  embedding vector(768),
  response text not null,
  hit_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists semantic_cache_embedding_idx
  on semantic_cache using ivfflat (embedding vector_cosine_ops) with (lists = 50);

create index if not exists semantic_cache_soul_idx
  on semantic_cache (soul_id, world_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. LORE FOLDERS — Chapter/tome organization for lore entries
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists lore_folders (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  parent_id uuid references lore_folders(id) on delete cascade,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists lore_folders_world_idx
  on lore_folders (world_id);

-- Add folder_id to lore_entries for chapter organization
alter table lore_entries
  add column if not exists folder_id uuid references lore_folders(id) on delete set null;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. ENTITY RELATIONSHIPS — User-defined edges between entities
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists entity_relationships (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id),
  source_entity_id uuid references entities(id) on delete cascade not null,
  target_entity_id uuid references entities(id) on delete cascade not null,
  label text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source_entity_id, target_entity_id, label)
);

create index if not exists entity_relationships_world_idx
  on entity_relationships (world_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. TAVERN SESSIONS — Multi-soul chat rooms
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists tavern_sessions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  name text not null default 'The Tavern',
  soul_ids uuid[] not null default '{}',
  created_at timestamptz default now(),
  last_active timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. TAVERN MESSAGES — Messages within tavern sessions
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists tavern_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references tavern_sessions(id) on delete cascade not null,
  soul_id uuid references souls(id) on delete set null,
  role text not null check (role in ('user', 'director', 'soul')),
  directed_to uuid references souls(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists tavern_messages_session_idx
  on tavern_messages (session_id, created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. ALTER MESSAGES — Add source chunk IDs for lore attribution
-- ──────────────────────────────────────────────────────────────────────────────

alter table messages
  add column if not exists source_chunk_ids uuid[];

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. ADD PROCESSING STATUS COLUMN TO LORE ENTRIES
-- Tracks Inngest job status: 'pending' | 'processing' | 'complete' | 'failed'
-- ──────────────────────────────────────────────────────────────────────────────

alter table lore_entries
  add column if not exists processing_status text default 'complete'
    check (processing_status in ('pending', 'processing', 'complete', 'failed'));

alter table lore_entries
  add column if not exists inngest_event_id text;

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. TRIGGERS — Updated_at triggers for new tables
-- ──────────────────────────────────────────────────────────────────────────────

drop trigger if exists set_lore_folders_updated_at on lore_folders;
create trigger set_lore_folders_updated_at before update on lore_folders
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_entity_relationships_updated_at on entity_relationships;
create trigger set_entity_relationships_updated_at before update on entity_relationships
  for each row execute procedure public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. RPC — Semantic cache similarity search
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function public.match_semantic_cache(
  query_embedding vector(768),
  soul_uuid uuid,
  world_uuid uuid,
  threshold float default 0.98
)
returns table (
  id uuid,
  prompt_text text,
  response text,
  similarity float
)
language sql
as $$
  select
    semantic_cache.id,
    semantic_cache.prompt_text,
    semantic_cache.response,
    1 - (semantic_cache.embedding <=> query_embedding) as similarity
  from semantic_cache
  where semantic_cache.soul_id = soul_uuid
    and semantic_cache.world_id = world_uuid
    and 1 - (semantic_cache.embedding <=> query_embedding) >= threshold
  order by semantic_cache.embedding <=> query_embedding
  limit 1;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. ROW LEVEL SECURITY — Enable RLS on all new tables
-- ──────────────────────────────────────────────────────────────────────────────

alter table failed_jobs enable row level security;
alter table semantic_cache enable row level security;
alter table lore_folders enable row level security;
alter table entity_relationships enable row level security;
alter table tavern_sessions enable row level security;
alter table tavern_messages enable row level security;

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. RLS POLICIES
-- ──────────────────────────────────────────────────────────────────────────────

-- failed_jobs: users can only see their own failed jobs
create policy "failed_jobs_owner_access" on failed_jobs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- semantic_cache: owner access via world ownership
create policy "semantic_cache_owner_access" on semantic_cache
  for all using (
    exists (select 1 from worlds where worlds.id = semantic_cache.world_id and worlds.user_id = auth.uid())
  ) with check (
    exists (select 1 from worlds where worlds.id = semantic_cache.world_id and worlds.user_id = auth.uid())
  );

-- lore_folders: owner access via world ownership
create policy "lore_folders_owner_access" on lore_folders
  for all using (
    exists (select 1 from worlds where worlds.id = lore_folders.world_id and worlds.user_id = auth.uid())
  ) with check (
    exists (select 1 from worlds where worlds.id = lore_folders.world_id and worlds.user_id = auth.uid())
  );
create policy "lore_folders_demo_read" on lore_folders
  for select using (
    exists (select 1 from worlds where worlds.id = lore_folders.world_id and worlds.is_demo = true)
  );

-- entity_relationships: owner access via world ownership
create policy "entity_relationships_owner_access" on entity_relationships
  for all using (
    exists (select 1 from worlds where worlds.id = entity_relationships.world_id and worlds.user_id = auth.uid())
  ) with check (
    exists (select 1 from worlds where worlds.id = entity_relationships.world_id and worlds.user_id = auth.uid())
  );
create policy "entity_relationships_demo_read" on entity_relationships
  for select using (
    exists (select 1 from worlds where worlds.id = entity_relationships.world_id and worlds.is_demo = true)
  );

-- tavern_sessions: users can only see their own sessions
create policy "tavern_sessions_owner_access" on tavern_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tavern_messages: access via session ownership
create policy "tavern_messages_owner_access" on tavern_messages
  for all using (
    exists (select 1 from tavern_sessions where tavern_sessions.id = tavern_messages.session_id and tavern_sessions.user_id = auth.uid())
  ) with check (
    exists (select 1 from tavern_sessions where tavern_sessions.id = tavern_messages.session_id and tavern_sessions.user_id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 13. SERVICE ROLE POLICY — Allow Inngest (service role) to update lore entries
-- The Inngest background worker uses the service role key, which bypasses RLS.
-- No additional policy needed; service_role already has full access.
-- This comment is documentation for future maintainers.
-- ──────────────────────────────────────────────────────────────────────────────
