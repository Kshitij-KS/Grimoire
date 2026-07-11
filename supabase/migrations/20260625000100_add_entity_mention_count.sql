-- Fix: the `entities` table was missing the `mention_count` column that both
-- entity-upsert RPCs (`upsert_entities_with_mention` and
-- `increment_entity_mentions`) insert into and update. Without it, those RPCs
-- fail at runtime with `column "mention_count" of relation "entities" does not
-- exist`, which surfaced during lore inscribe as the opaque "Lore ingest
-- failed." once the LLM extracted any entities.
--
-- Idempotent so it is safe to re-run and safe on databases where the column may
-- already have been added manually.
alter table entities
  add column if not exists mention_count integer not null default 0;
