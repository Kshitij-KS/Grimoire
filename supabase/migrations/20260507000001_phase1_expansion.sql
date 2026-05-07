-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1 — Grimoire Schema Expansion (2026-05-07)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. tavern_sessions: premise + canonized
-- 2. entity_relationships: tension_score
-- 3. lore_chunks: entity_id FK (resolves name-based tag fragility)
-- 4. FK cascade hardening on lore_chunks, consistency_flags, entity_relationships
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tavern session enhancements ─────────────────────────────────────────

ALTER TABLE tavern_sessions
  ADD COLUMN IF NOT EXISTS premise      TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS canonized    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canonized_lore_entry_id UUID REFERENCES lore_entries(id) ON DELETE SET NULL;

-- ── 2. Entity relationship tension scoring ─────────────────────────────────
-- tension_score: -1 (hostile), 0 (neutral), 1 (allied)

ALTER TABLE entity_relationships
  ADD COLUMN IF NOT EXISTS tension_score SMALLINT NOT NULL DEFAULT 0
    CHECK (tension_score IN (-1, 0, 1));

-- ── 3. Lore chunk entity FK ────────────────────────────────────────────────
-- Adds a hard FK so merges can update by entity_id instead of text name.

ALTER TABLE lore_chunks
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lore_chunks_entity_id_idx ON lore_chunks(entity_id);

-- ── 4. FK cascade hardening ────────────────────────────────────────────────
-- Ensure deleting a lore_entry cascades to its chunks.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lore_chunks_lore_entry_id_fkey'
  ) THEN
    ALTER TABLE lore_chunks DROP CONSTRAINT lore_chunks_lore_entry_id_fkey;
  END IF;
END$$;

ALTER TABLE lore_chunks
  ADD CONSTRAINT lore_chunks_lore_entry_id_fkey
    FOREIGN KEY (lore_entry_id) REFERENCES lore_entries(id) ON DELETE CASCADE;

-- Ensure deleting a consistency_check cascades to its flags.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'consistency_flags_check_id_fkey'
  ) THEN
    ALTER TABLE consistency_flags DROP CONSTRAINT consistency_flags_check_id_fkey;
  END IF;
END$$;

ALTER TABLE consistency_flags
  ADD CONSTRAINT consistency_flags_check_id_fkey
    FOREIGN KEY (check_id) REFERENCES consistency_checks(id) ON DELETE CASCADE;

-- Ensure deleting an entity cascades its relationships (both directions).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_relationships_source_entity_id_fkey'
  ) THEN
    ALTER TABLE entity_relationships DROP CONSTRAINT entity_relationships_source_entity_id_fkey;
  END IF;
END$$;

ALTER TABLE entity_relationships
  ADD CONSTRAINT entity_relationships_source_entity_id_fkey
    FOREIGN KEY (source_entity_id) REFERENCES entities(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_relationships_target_entity_id_fkey'
  ) THEN
    ALTER TABLE entity_relationships DROP CONSTRAINT entity_relationships_target_entity_id_fkey;
  END IF;
END$$;

ALTER TABLE entity_relationships
  ADD CONSTRAINT entity_relationships_target_entity_id_fkey
    FOREIGN KEY (target_entity_id) REFERENCES entities(id) ON DELETE CASCADE;

-- ── 5. Indexes for performance ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tavern_sessions_canonized_idx ON tavern_sessions(world_id, canonized);
CREATE INDEX IF NOT EXISTS entity_relationships_tension_idx ON entity_relationships(world_id, tension_score);
