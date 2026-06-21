-- ============================================================================
-- Fix: lore_chunks was overlooked in the world-collaboration RLS model.
--
-- The collaboration migration (20260415000100) added member-read and
-- editor-write policies to lore_entries, entities, souls and consistency_checks,
-- but NOT to lore_chunks. Because public.match_lore_chunks is a SQL function
-- running as SECURITY INVOKER, RLS on lore_chunks applies to retrieval — so
-- non-owner collaborators got ZERO chunks back from the Query_Path RPCs
-- (search, tavern, narrator, consistency). Editors also could not ingest chunks
-- through their own client (the synchronous Lore_Pipeline write path).
--
-- This migration mirrors the established collaboration pattern: world members
-- can READ a world's lore_chunks, and editor members can WRITE them. The
-- existing owner-only "lore_chunks_owner_access" and "lore_chunks_demo_read"
-- policies remain; RLS policies are permissive (OR-combined), so these are
-- purely additive.
-- ============================================================================

alter table lore_chunks enable row level security;

-- ── Read: any world member (viewer or editor), plus the owner ───────────────
drop policy if exists "Members can read world lore chunks" on lore_chunks;
create policy "Members can read world lore chunks"
  on lore_chunks for select
  using (
    exists (
      select 1 from worlds
      where worlds.id = lore_chunks.world_id and worlds.user_id = auth.uid()
    )
    or exists (
      select 1 from world_members
      where world_members.world_id = lore_chunks.world_id
        and world_members.user_id = auth.uid()
    )
  );

-- ── Write: editor members, plus the owner ───────────────────────────────────
drop policy if exists "Editor members can insert lore chunks" on lore_chunks;
create policy "Editor members can insert lore chunks"
  on lore_chunks for insert
  with check (
    exists (
      select 1 from worlds
      where worlds.id = lore_chunks.world_id and worlds.user_id = auth.uid()
    )
    or exists (
      select 1 from world_members
      where world_members.world_id = lore_chunks.world_id
        and world_members.user_id = auth.uid()
        and world_members.role = 'editor'
    )
  );

drop policy if exists "Editor members can update lore chunks" on lore_chunks;
create policy "Editor members can update lore chunks"
  on lore_chunks for update
  using (
    exists (
      select 1 from worlds
      where worlds.id = lore_chunks.world_id and worlds.user_id = auth.uid()
    )
    or exists (
      select 1 from world_members
      where world_members.world_id = lore_chunks.world_id
        and world_members.user_id = auth.uid()
        and world_members.role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from worlds
      where worlds.id = lore_chunks.world_id and worlds.user_id = auth.uid()
    )
    or exists (
      select 1 from world_members
      where world_members.world_id = lore_chunks.world_id
        and world_members.user_id = auth.uid()
        and world_members.role = 'editor'
    )
  );

drop policy if exists "Editor members can delete lore chunks" on lore_chunks;
create policy "Editor members can delete lore chunks"
  on lore_chunks for delete
  using (
    exists (
      select 1 from worlds
      where worlds.id = lore_chunks.world_id and worlds.user_id = auth.uid()
    )
    or exists (
      select 1 from world_members
      where world_members.world_id = lore_chunks.world_id
        and world_members.user_id = auth.uid()
        and world_members.role = 'editor'
    )
  );
