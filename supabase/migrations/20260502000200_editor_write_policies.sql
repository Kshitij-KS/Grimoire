-- Align RLS with route-level collaboration checks.
-- Owners keep full access through existing policies; editor members can mutate
-- world content, while viewers remain read-only.

drop policy if exists "Editor members can update lore entries" on lore_entries;
create policy "Editor members can update lore entries"
  on lore_entries for update
  using (
    exists (
      select 1 from world_members
      where world_id = lore_entries.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from world_members
      where world_id = lore_entries.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can delete lore entries" on lore_entries;
create policy "Editor members can delete lore entries"
  on lore_entries for delete
  using (
    exists (
      select 1 from world_members
      where world_id = lore_entries.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can insert entities" on entities;
create policy "Editor members can insert entities"
  on entities for insert
  with check (
    exists (
      select 1 from world_members
      where world_id = entities.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can update entities" on entities;
create policy "Editor members can update entities"
  on entities for update
  using (
    exists (
      select 1 from world_members
      where world_id = entities.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from world_members
      where world_id = entities.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can delete entities" on entities;
create policy "Editor members can delete entities"
  on entities for delete
  using (
    exists (
      select 1 from world_members
      where world_id = entities.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can insert souls" on souls;
create policy "Editor members can insert souls"
  on souls for insert
  with check (
    exists (
      select 1 from world_members
      where world_id = souls.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can update souls" on souls;
create policy "Editor members can update souls"
  on souls for update
  using (
    exists (
      select 1 from world_members
      where world_id = souls.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from world_members
      where world_id = souls.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can delete souls" on souls;
create policy "Editor members can delete souls"
  on souls for delete
  using (
    exists (
      select 1 from world_members
      where world_id = souls.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can manage entity relationships" on entity_relationships;
create policy "Editor members can manage entity relationships"
  on entity_relationships for all
  using (
    exists (
      select 1 from world_members
      where world_id = entity_relationships.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from world_members
      where world_id = entity_relationships.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );

drop policy if exists "Editor members can manage semantic cache" on semantic_cache;
create policy "Editor members can manage semantic cache"
  on semantic_cache for all
  using (
    exists (
      select 1 from world_members
      where world_id = semantic_cache.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from world_members
      where world_id = semantic_cache.world_id
        and user_id = auth.uid()
        and role = 'editor'
    )
  );
