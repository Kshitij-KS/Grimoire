-- Repair deployed match_semantic_cache function created with stale prompt_embedding references.
create or replace function public.match_semantic_cache(
  query_embedding public.vector(768),
  soul_uuid uuid,
  world_uuid uuid,
  user_uuid uuid,
  threshold float default 0.98,
  match_count int default 1
)
returns table (
  id uuid,
  response text,
  similarity float,
  hit_count int
)
language plpgsql stable
as $$
begin
  return query
  select
    semantic_cache.id,
    semantic_cache.response,
    1 - (semantic_cache.embedding <=> query_embedding) as similarity,
    semantic_cache.hit_count
  from semantic_cache
  where
    semantic_cache.soul_id = soul_uuid
    and semantic_cache.world_id = world_uuid
    and (semantic_cache.user_id = user_uuid or semantic_cache.user_id is null)
    and 1 - (semantic_cache.embedding <=> query_embedding) > threshold
  order by semantic_cache.embedding <=> query_embedding
  limit match_count;
end;
$$;
