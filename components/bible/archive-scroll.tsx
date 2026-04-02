"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Entity, EntityRelationship, EntityType, Soul } from "@/lib/types";

// ── Type metadata ─────────────────────────────────────────────────────────

const TYPE_COLORS: Record<EntityType, string> = {
  character: "var(--accent)",
  location:  "var(--ai-pulse)",
  faction:   "var(--danger)",
  artifact:  "var(--accent-soft)",
  event:     "var(--success)",
  rule:      "var(--text-muted)",
};

const TYPE_ORDER: EntityType[] = [
  "character", "faction", "location", "artifact", "event", "rule"
];

// ── Lore Fragment ─────────────────────────────────────────────────────────

function LoreFragment({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 240;

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p
        className={`font-heading text-sm italic leading-relaxed text-[var(--text-muted)] ${!expanded && isLong ? "line-clamp-3" : ""}`}
      >
        &ldquo;{content}&rdquo;
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Collapse" : "Read more"}
        </button>
      )}
    </div>
  );
}

// ── Entity article ────────────────────────────────────────────────────────

function EntityArticle({
  entity,
  relationships,
  allEntities,
  souls,
  index,
}: {
  entity: Entity;
  relationships: EntityRelationship[];
  allEntities: Entity[];
  souls: Soul[];
  index: number;
}) {
  const color = TYPE_COLORS[entity.type];

  // Relationships where this entity is source or target
  const entityRels = relationships.filter(
    (r) => r.source_entity_id === entity.id || r.target_entity_id === entity.id
  );

  // Check if a soul exists for this entity
  const hasSoul = souls.some((s) => s.name.toLowerCase() === entity.name.toLowerCase());

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-[var(--border)] py-10 last:border-0 first:pt-0"
    >
      <div className="flex items-start gap-5">
        {/* Left accent bar */}
        <div
          className="mt-2 w-1 self-stretch rounded-full opacity-70"
          style={{ background: `linear-gradient(180deg, ${color}, transparent)`, minHeight: 60 }}
        />

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Header */}
          <div>
            <p className="chapter-label mb-1">{entity.type}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-3xl leading-tight">{entity.name}</h2>
              {hasSoul && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: `color-mix(in srgb, var(--ai-pulse) 15%, transparent)`,
                    color: "var(--ai-pulse)",
                  }}
                >
                  Soul bound
                </span>
              )}
              {(entity.mention_count ?? 0) > 0 && (
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                  Mentioned {entity.mention_count}×
                </span>
              )}
            </div>
          </div>

          {/* Summary */}
          {entity.summary && (
            <p className="text-sm leading-7 text-[var(--text-muted)]">{entity.summary}</p>
          )}

          {/* Lore fragments */}
          {entity.lore_chunks && entity.lore_chunks.length > 0 && (
            <div className="space-y-2">
              <p className="chapter-label">From the Lore</p>
              {entity.lore_chunks.slice(0, 3).map((chunk) => (
                <LoreFragment key={chunk.id} content={chunk.content} />
              ))}
            </div>
          )}

          {/* Relationships */}
          {entityRels.length > 0 && (
            <div className="space-y-2">
              <p className="chapter-label">Connections</p>
              <div className="flex flex-wrap gap-2">
                {entityRels.map((r) => {
                  const otherId =
                    r.source_entity_id === entity.id ? r.target_entity_id : r.source_entity_id;
                  const other = allEntities.find((e) => e.id === otherId);
                  if (!other) return null;
                  return (
                    <span
                      key={r.id}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs"
                    >
                      <span className="text-[var(--text-muted)]">{r.label}: </span>
                      <span className="text-[var(--text-main)]">{other.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface ArchiveScrollProps {
  entities: Entity[];
  relationships: EntityRelationship[];
  souls: Soul[];
  worldId: string;
}

export function ArchiveScroll({ entities, relationships, souls }: ArchiveScrollProps) {
  const [activeFilter, setActiveFilter] = useState<EntityType | "all">("all");

  const grouped: Partial<Record<EntityType, Entity[]>> = {};
  for (const type of TYPE_ORDER) {
    const list = entities.filter((e) => e.type === type);
    if (list.length > 0) grouped[type] = list;
  }

  const filteredEntities =
    activeFilter === "all"
      ? TYPE_ORDER.flatMap((t) => grouped[t] ?? [])
      : (grouped[activeFilter] ?? []);

  if (entities.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="font-heading text-6xl opacity-20">ᚷ</p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No entities have been discovered yet.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)] opacity-60">
          Inscribe lore to populate the Archive.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] px-6 py-3">
        <button
          onClick={() => setActiveFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
            activeFilter === "all"
              ? "bg-[var(--surface-raised)] text-[var(--text-main)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
          }`}
        >
          All ({entities.length})
        </button>
        {TYPE_ORDER.filter((t) => grouped[t]).map((t) => {
          const color = TYPE_COLORS[t];
          return (
            <button
              key={t}
              onClick={() => setActiveFilter(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                activeFilter === t
                  ? "text-[var(--text-main)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
              style={
                activeFilter === t
                  ? { background: `color-mix(in srgb, ${color} 15%, var(--surface-raised))` }
                  : undefined
              }
            >
              {t}s ({grouped[t]!.length})
            </button>
          );
        })}
      </div>

      {/* Scrollable compendium */}
      <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFilter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {filteredEntities.map((entity, i) => (
                <EntityArticle
                  key={entity.id}
                  entity={entity}
                  relationships={relationships}
                  allEntities={entities}
                  souls={souls}
                  index={i}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
