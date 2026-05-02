-- New migration: 20260503000100_increment_entity_mentions.sql
CREATE OR REPLACE FUNCTION public.upsert_entity_with_mention(
  p_world_id uuid,
  p_name text,
  p_type text,
  p_summary text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO entities (world_id, name, type, summary, mention_count, first_mentioned_at)
  VALUES (p_world_id, p_name, p_type, p_summary, 1, now())
  ON CONFLICT (world_id, normalized_name, type)
  DO UPDATE SET
    summary = EXCLUDED.summary,
    mention_count = COALESCE(entities.mention_count, 0) + 1,
    updated_at = now();
END;
$$;
