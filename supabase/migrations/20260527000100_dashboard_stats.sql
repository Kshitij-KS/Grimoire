-- Migration: get_dashboard_stats RPC function
-- Replaces N×3 per-world count queries with a single aggregated call

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_world_ids uuid[])
RETURNS TABLE (
  world_id uuid,
  lore_count bigint,
  soul_count bigint,
  entity_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id AS world_id,
    COALESCE(l.cnt, 0) AS lore_count,
    COALESCE(s.cnt, 0) AS soul_count,
    COALESCE(e.cnt, 0) AS entity_count
  FROM unnest(p_world_ids) AS w(id)
  LEFT JOIN (
    SELECT le.world_id, COUNT(*) AS cnt
    FROM lore_entries le
    WHERE le.world_id = ANY(p_world_ids)
    GROUP BY le.world_id
  ) l ON l.world_id = w.id
  LEFT JOIN (
    SELECT so.world_id, COUNT(*) AS cnt
    FROM souls so
    WHERE so.world_id = ANY(p_world_ids)
    GROUP BY so.world_id
  ) s ON s.world_id = w.id
  LEFT JOIN (
    SELECT en.world_id, COUNT(*) AS cnt
    FROM entities en
    WHERE en.world_id = ANY(p_world_ids)
    GROUP BY en.world_id
  ) e ON e.world_id = w.id;
END;
$$;
