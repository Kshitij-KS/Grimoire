-- ============================================================================
-- Grimoire World Collaboration Migration
-- Adds: world_members, world_invitations
-- Alters: worlds, lore_entries, entities, souls (member access policies)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. WORLD MEMBERS — Shared access to worlds
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists world_members (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  invited_by uuid references profiles(id),
  joined_at timestamptz default now(),
  unique (world_id, user_id)
);

create index if not exists world_members_world_idx on world_members (world_id);
create index if not exists world_members_user_idx on world_members (user_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. WORLD INVITATIONS — Token-based invite links
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists world_invitations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('editor', 'viewer')),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_by uuid references profiles(id),
  expires_at timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists world_invitations_token_idx on world_invitations (token);
create index if not exists world_invitations_world_idx on world_invitations (world_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────────────────────

alter table world_members enable row level security;

create policy "Members can view their own memberships"
  on world_members for select
  using (user_id = auth.uid());

create policy "World owner can manage members"
  on world_members for all
  using (
    exists (
      select 1 from worlds where id = world_id and user_id = auth.uid()
    )
  );

alter table world_invitations enable row level security;

create policy "World owner can manage invitations"
  on world_invitations for all
  using (
    exists (
      select 1 from worlds where id = world_id and user_id = auth.uid()
    )
  );

create policy "Anyone can read invitation by token"
  on world_invitations for select
  using (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. EXTEND WORLD ACCESS — Allow members to read shared worlds
-- ──────────────────────────────────────────────────────────────────────────────

-- NOTE: If an existing "owner can select" policy exists on worlds, drop it first
-- and recreate with member access. In a fresh DB the original migration already
-- has "Users can view own worlds" — we add a separate member-access policy.

create policy "Members can read shared worlds"
  on worlds for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from world_members where world_id = id and user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. MEMBER ACCESS TO WORLD DATA
-- ──────────────────────────────────────────────────────────────────────────────

-- Lore entries: members can read; editors can insert
create policy "Members can read world lore entries"
  on lore_entries for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from world_members
      where world_id = lore_entries.world_id and user_id = auth.uid()
    )
  );

create policy "Editor members can insert lore entries"
  on lore_entries for insert
  with check (
    exists (
      select 1 from world_members
      where world_id = lore_entries.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
    or exists (
      select 1 from worlds where id = lore_entries.world_id and user_id = auth.uid()
    )
  );

-- Entities: members can read (entities has no user_id — ownership is via worlds.user_id)
create policy "Members can read world entities"
  on entities for select
  using (
    exists (
      select 1 from worlds where id = entities.world_id and user_id = auth.uid()
    )
    or exists (
      select 1 from world_members
      where world_id = entities.world_id and user_id = auth.uid()
    )
  );

-- Souls: members can read
create policy "Members can read world souls"
  on souls for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from world_members
      where world_id = souls.world_id and user_id = auth.uid()
    )
  );

-- Consistency checks: members can read
create policy "Members can read world consistency checks"
  on consistency_checks for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from world_members
      where world_id = consistency_checks.world_id and user_id = auth.uid()
    )
  );
