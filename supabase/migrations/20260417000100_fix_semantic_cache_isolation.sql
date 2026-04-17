-- Fix semantic cache isolation by adding user_id column
ALTER TABLE semantic_cache ADD COLUMN user_id uuid REFERENCES profiles(id);

-- For new entries automatically set user_id from auth
ALTER TABLE semantic_cache ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Create index for user_id
CREATE INDEX idx_semantic_cache_user_id ON semantic_cache(user_id);

-- Update match_semantic_cache RPC to include user isolation
CREATE OR REPLACE FUNCTION match_semantic_cache(
  query_embedding vector(768),
  soul_uuid uuid,
  world_uuid uuid,
  user_uuid uuid,
  threshold float DEFAULT 0.98,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  response text,
  similarity float,
  hit_count int
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    semantic_cache.id,
    semantic_cache.response,
    1 - (semantic_cache.prompt_embedding <=> query_embedding) as similarity,
    semantic_cache.hit_count
  FROM semantic_cache
  WHERE
    semantic_cache.soul_id = soul_uuid
    AND semantic_cache.world_id = world_uuid
    AND (semantic_cache.user_id = user_uuid OR semantic_cache.user_id IS NULL)
    AND 1 - (semantic_cache.prompt_embedding <=> query_embedding) > threshold
  ORDER BY semantic_cache.prompt_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;