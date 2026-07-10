-- New migration: 20260623000100_replace_entity_tag.sql
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
