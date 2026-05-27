-- New migration to support batch upsert of entities
CREATE OR REPLACE FUNCTION public.upsert_entities_with_mention(
  p_entities jsonb
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO entities (world_id, name, type, summary, mention_count, first_mentioned_at)
  SELECT
    (e->>'world_id')::uuid,
    MAX(e->>'name'),
    e->>'type',
    MAX(e->>'summary'),
    COUNT(*)::int,
    now()
  FROM jsonb_array_elements(p_entities) AS e
  GROUP BY (e->>'world_id')::uuid, lower(e->>'name'), e->>'type'
  ON CONFLICT (world_id, normalized_name, type)
  DO UPDATE SET
    summary = EXCLUDED.summary,
    mention_count = COALESCE(entities.mention_count, 0) + EXCLUDED.mention_count,
    updated_at = now();
END;
$$;
