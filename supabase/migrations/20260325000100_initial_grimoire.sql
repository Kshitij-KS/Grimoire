create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid references auth.users(id) primary key,
  username text unique,
  display_name text,
  plan text default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz default now()
);

create table if not exists worlds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  genre text,
  tone text,
  premise text,
  cover_color text default '#7c5cbf',
  is_demo boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists lore_entries (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id),
  content text not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists lore_chunks (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  lore_entry_id uuid references lore_entries(id) on delete cascade,
  content text not null,
  embedding vector(768),
  entity_tags text[],
  chunk_index integer,
  created_at timestamptz default now()
);

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  name text not null,
  type text not null check (type in ('character', 'location', 'faction', 'artifact', 'event', 'rule')),
  summary text,
  normalized_name text generated always as (lower(name)) stored,
  first_mentioned_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (world_id, normalized_name, type)
);

create table if not exists souls (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id),
  name text not null,
  description text not null,
  soul_card jsonb,
  avatar_color text default '#7c5cbf',
  avatar_initials text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  soul_id uuid references souls(id) on delete cascade,
  user_id uuid references profiles(id),
  world_id uuid references worlds(id),
  compressed_history text,
  created_at timestamptz default now(),
  last_active timestamptz default now(),
  unique (user_id, soul_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists consistency_checks (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id),
  source_text text not null,
  created_at timestamptz default now()
);

create table if not exists consistency_flags (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  check_id uuid references consistency_checks(id) on delete cascade,
  flagged_text text not null,
  contradiction text not null,
  existing_reference text,
  severity text default 'medium' check (severity in ('low', 'medium', 'high')),
  resolved boolean default false,
  created_at timestamptz default now()
);

create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  date date default current_date,
  count integer default 1,
  unique (user_id, action, date)
);

create index if not exists lore_chunks_embedding_idx
  on lore_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.match_lore_chunks(
  world_uuid uuid,
  query_embedding vector(768),
  match_count integer default 4,
  filter_tags text[] default null
)
returns table (
  id uuid,
  lore_entry_id uuid,
  content text,
  entity_tags text[],
  similarity float
)
language sql
as $$
  select
    lore_chunks.id,
    lore_chunks.lore_entry_id,
    lore_chunks.content,
    lore_chunks.entity_tags,
    1 - (lore_chunks.embedding <=> query_embedding) as similarity
  from lore_chunks
  where lore_chunks.world_id = world_uuid
    and (
      filter_tags is null
      or lore_chunks.entity_tags && filter_tags
    )
  order by lore_chunks.embedding <=> query_embedding
  limit match_count;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists set_worlds_updated_at on worlds;
create trigger set_worlds_updated_at before update on worlds
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_lore_entries_updated_at on lore_entries;
create trigger set_lore_entries_updated_at before update on lore_entries
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_entities_updated_at on entities;
create trigger set_entities_updated_at before update on entities
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_souls_updated_at on souls;
create trigger set_souls_updated_at before update on souls
  for each row execute procedure public.set_updated_at();

alter table profiles enable row level security;
alter table worlds enable row level security;
alter table lore_entries enable row level security;
alter table lore_chunks enable row level security;
alter table entities enable row level security;
alter table souls enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table consistency_checks enable row level security;
alter table consistency_flags enable row level security;
alter table rate_limits enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "worlds_owner_full_access" on worlds for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "worlds_demo_public_read" on worlds for select using (is_demo = true);

create policy "lore_entries_owner_access" on lore_entries for all using (
  exists (select 1 from worlds where worlds.id = lore_entries.world_id and worlds.user_id = auth.uid())
) with check (
  exists (select 1 from worlds where worlds.id = lore_entries.world_id and worlds.user_id = auth.uid())
);
create policy "lore_entries_demo_read" on lore_entries for select using (
  exists (select 1 from worlds where worlds.id = lore_entries.world_id and worlds.is_demo = true)
);

create policy "lore_chunks_owner_access" on lore_chunks for all using (
  exists (select 1 from worlds where worlds.id = lore_chunks.world_id and worlds.user_id = auth.uid())
) with check (
  exists (select 1 from worlds where worlds.id = lore_chunks.world_id and worlds.user_id = auth.uid())
);
create policy "lore_chunks_demo_read" on lore_chunks for select using (
  exists (select 1 from worlds where worlds.id = lore_chunks.world_id and worlds.is_demo = true)
);

create policy "entities_owner_access" on entities for all using (
  exists (select 1 from worlds where worlds.id = entities.world_id and worlds.user_id = auth.uid())
) with check (
  exists (select 1 from worlds where worlds.id = entities.world_id and worlds.user_id = auth.uid())
);
create policy "entities_demo_read" on entities for select using (
  exists (select 1 from worlds where worlds.id = entities.world_id and worlds.is_demo = true)
);

create policy "souls_owner_access" on souls for all using (
  exists (select 1 from worlds where worlds.id = souls.world_id and worlds.user_id = auth.uid())
) with check (
  exists (select 1 from worlds where worlds.id = souls.world_id and worlds.user_id = auth.uid())
);
create policy "souls_demo_read" on souls for select using (
  exists (select 1 from worlds where worlds.id = souls.world_id and worlds.is_demo = true)
);

create policy "conversations_owner_access" on conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "messages_owner_access" on messages for all using (
  exists (select 1 from conversations where conversations.id = messages.conversation_id and conversations.user_id = auth.uid())
) with check (
  exists (select 1 from conversations where conversations.id = messages.conversation_id and conversations.user_id = auth.uid())
);

create policy "consistency_checks_owner_access" on consistency_checks for all using (
  exists (select 1 from worlds where worlds.id = consistency_checks.world_id and worlds.user_id = auth.uid())
) with check (
  exists (select 1 from worlds where worlds.id = consistency_checks.world_id and worlds.user_id = auth.uid())
);
create policy "consistency_checks_demo_read" on consistency_checks for select using (
  exists (select 1 from worlds where worlds.id = consistency_checks.world_id and worlds.is_demo = true)
);

create policy "consistency_flags_owner_access" on consistency_flags for all using (
  exists (select 1 from worlds where worlds.id = consistency_flags.world_id and worlds.user_id = auth.uid())
) with check (
  exists (select 1 from worlds where worlds.id = consistency_flags.world_id and worlds.user_id = auth.uid())
);
create policy "consistency_flags_demo_read" on consistency_flags for select using (
  exists (select 1 from worlds where worlds.id = consistency_flags.world_id and worlds.is_demo = true)
);

create policy "rate_limits_owner_access" on rate_limits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
