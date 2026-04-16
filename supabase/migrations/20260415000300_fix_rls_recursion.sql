-- ============================================================================
-- Fix: infinite recursion in RLS policies for worlds / world_members
-- ============================================================================
--
-- Root cause
-- ──────────
-- worlds SELECT policy  "Members can read shared worlds"  queries world_members.
-- world_members ALL policy  "World owner can manage members"  queries worlds.
-- These two subqueries form a cycle; PostgreSQL detects it and raises:
--   "infinite recursion detected in policy for relation 'worlds'"
--
-- Fix
-- ───
-- Replace both recursive policies with versions that call SECURITY DEFINER
-- helper functions.  Security-definer functions execute with the privileges
-- of their owner (postgres / supabase_admin), bypassing RLS entirely, so
-- the inner query on the other table does not re-enter the policy evaluator.
-- We still gate everything on auth.uid(), so the authorization logic is
-- identical — just without the cycle.
-- ============================================================================

-- ── 1. Drop the two recursive policies ─────────────────────────────────────

drop policy if exists "Members can read shared worlds"   on worlds;
drop policy if exists "World owner can manage members"   on world_members;
drop policy if exists "World owner can manage invitations" on world_invitations;

-- ── 2. Security-definer helpers ────────────────────────────────────────────
-- These functions query across the RLS boundary without triggering policies.

-- Returns true if the current user owns the given world.
create or replace function public.grimoire_is_world_owner(p_world_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from worlds
    where id = p_world_id
      and user_id = auth.uid()
  );
$$;

-- Returns true if the current user is a member (any role) of the given world.
create or replace function public.grimoire_is_world_member(p_world_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from world_members
    where world_id = p_world_id
      and user_id = auth.uid()
  );
$$;

-- ── 3. Recreate worlds SELECT policy (non-recursive) ───────────────────────
-- The original "worlds_owner_full_access" (for ALL) still handles owner
-- writes; this policy adds member and demo read access.

create policy "Members can read shared worlds"
  on worlds for select
  using (
    user_id  = auth.uid()
    or is_demo = true
    or grimoire_is_world_member(id)
  );

-- ── 4. Recreate world_members policy (non-recursive) ───────────────────────

create policy "World owner can manage members"
  on world_members for all
  using      (grimoire_is_world_owner(world_id))
  with check (grimoire_is_world_owner(world_id));

-- ── 5. Recreate world_invitations policy (non-recursive) ───────────────────

create policy "World owner can manage invitations"
  on world_invitations for all
  using      (grimoire_is_world_owner(world_id))
  with check (grimoire_is_world_owner(world_id));
