-- New migration: 20260503000200_fix_semantic_cache_editor_rls.sql

-- Drop old owner-only policy
DROP POLICY IF EXISTS "semantic_cache_owner_access" ON semantic_cache;

-- Unified policy: world owner OR editor member
CREATE POLICY "semantic_cache_world_access" ON semantic_cache
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM worlds WHERE id = semantic_cache.world_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM world_members
      WHERE world_id = semantic_cache.world_id
        AND user_id = auth.uid()
        AND role = 'editor'
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM worlds WHERE id = semantic_cache.world_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM world_members
      WHERE world_id = semantic_cache.world_id
        AND user_id = auth.uid()
        AND role = 'editor'
    )
  );
