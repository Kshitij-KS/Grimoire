"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Entity, EntityRelationship, EntityType, Soul } from "@/lib/types";

// ── Type metadata ─────────────────────────────────────────────────────────

const TYPE_META: Record<EntityType, { label: string; color: string }> = {
  character:  { label: "Characters",  color: "var(--accent)" },
  location:   { label: "Locations",   color: "var(--ai-pulse)" },
  faction:    { label: "Factions",    color: "var(--danger)" },
  artifact:   { label: "Artifacts",   color: "var(--accent-soft)" },
  event:      { label: "Events",      color: "var(--success)" },
  rule:       { label: "Rules",       color: "var(--text-muted)" },
};

const ALL_TYPES = Object.keys(TYPE_META) as EntityType[];
const SORT_OPTIONS = ["name", "mentions", "type"] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

// ── Ink-drop mention indicator ─────────────────────────────────────────────

function InkDrops({ count, color }: { count: number; color: string }) {
  const visible = Math.min(count, 8);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: visible }).map((_, i) => (
        <span key={i} style={{ color, opacity: 0.3 + (i / visible) * 0.7, fontSize: 8 }}>
          ◆
        </span>
      ))}
      {count > 8 && (
        <span className="ml-0.5 text-[10px] text-[var(--text-muted)]">+{count - 8}</span>
      )}
    </div>
  );
}

// ── Entity card ────────────────────────────────────────────────────────────

function CodexCard({
  entity,
  relationshipCount,
  hasSoul,
  isSelected,
  isSpotlit,
  onClick,
  onCreateSoul,
  canCreateSoul,
  index,
}: {
  entity: Entity;
  relationshipCount: number;
  hasSoul: boolean;
  isSelected: boolean;
  isSpotlit: boolean;
  onClick: () => void;
  onCreateSoul?: (name: string) => void;
  canCreateSoul?: boolean;
  index: number;
}) {
  const meta = TYPE_META[entity.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, scale: isSpotlit ? 1.02 : 1 }}
      transition={{ delay: index * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[16px] border p-4 transition-all duration-200",
        "hover:border-[var(--border-focus)] hover:-translate-y-1",
        "active:scale-[0.97] active:transition-none",
        isSelected
          ? "border-[var(--border-focus)] bg-[var(--surface-raised)]"
          : "border-[var(--border)] bg-[var(--surface)]",
        isSpotlit ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]" : ""
      )}
      style={{
        background: isSelected
          ? `linear-gradient(180deg, color-mix(in srgb, ${meta.color} 6%, var(--surface-raised)) 0%, var(--surface-raised) 30%)`
          : undefined,
      }}
    >
      {/* Top color edge */}
      <div
        className="absolute left-0 right-0 top-0 h-[3px] rounded-t-[16px] opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }}
      />

      {/* Spotlight ripple */}
      {isSpotlit && (
        <div className="arcane-ripple pointer-events-none absolute inset-0 rounded-[16px]" />
      )}

      <div className="mt-1 space-y-2">
        {/* Type label */}
        <p className="chapter-label">{entity.type}</p>

        {/* Name */}
        <h3
          className="font-heading text-xl leading-tight transition-colors duration-200 group-hover:text-[var(--accent)]"
          style={{ color: isSelected ? meta.color : undefined }}
        >
          {entity.name}
        </h3>

        {/* Summary */}
        {entity.summary && (
          <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
            {entity.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <InkDrops count={entity.mention_count ?? 0} color={meta.color} />
          <div className="flex items-center gap-2">
            {relationshipCount > 0 && (
              <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                {relationshipCount} link{relationshipCount !== 1 ? "s" : ""}
              </span>
            )}
            {hasSoul && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{
                  background: `color-mix(in srgb, var(--ai-pulse) 15%, transparent)`,
                  color: "var(--ai-pulse)",
                }}
              >
                Soul
              </span>
            )}
          </div>
        </div>

        {/* Forge Soul — character only, visible on hover */}
        {entity.type === "character" && canCreateSoul && !hasSoul && onCreateSoul && (
          <div className="overflow-hidden">
            <motion.button
              onClick={(e) => { e.stopPropagation(); onCreateSoul(entity.name); }}
              initial={false}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "mt-1 flex w-full items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-xs font-medium",
                "border border-[var(--border)] text-[var(--text-muted)]",
                "opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                "hover:border-[var(--accent)] hover:text-[var(--accent)]"
              )}
            >
              <Sparkles className="h-3 w-3" />
              Forge Soul
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface ArchiveCodexProps {
  entities: Entity[];
  relationships: EntityRelationship[];
  souls: Soul[];
  worldId: string;
  onSelectEntity: (id: string | null) => void;
  selectedEntityId: string | null;
  canCreateSoul?: boolean;
  onCreateSoul?: (name: string) => void;
  spotlightEntityId?: string | null;
}

export function ArchiveCodex({
  entities,
  relationships,
  souls,
  onSelectEntity,
  selectedEntityId,
  canCreateSoul = false,
  onCreateSoul,
  spotlightEntityId,
}: ArchiveCodexProps) {
  const [activeType, setActiveType] = useState<EntityType | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("mentions");
  const [search, setSearch] = useState("");

  // Pre-compute type counts and relationship counts
  const typeCounts = useMemo(
    () =>
      ALL_TYPES.reduce<Record<EntityType, number>>((acc, t) => {
        acc[t] = entities.filter((e) => e.type === t).length;
        return acc;
      }, {} as Record<EntityType, number>),
    [entities]
  );

  const relCountById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of relationships) {
      map[r.source_entity_id] = (map[r.source_entity_id] ?? 0) + 1;
      map[r.target_entity_id] = (map[r.target_entity_id] ?? 0) + 1;
    }
    return map;
  }, [relationships]);

  const soulEntityNames = useMemo(
    () => new Set(souls.map((s) => s.name.toLowerCase())),
    [souls]
  );

  const filtered = useMemo(() => {
    let list = [...entities];
    if (activeType !== "all") list = list.filter((e) => e.type === activeType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.summary?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "mentions") return (b.mention_count ?? 0) - (a.mention_count ?? 0);
      return a.type.localeCompare(b.type);
    });
    return list;
  }, [entities, activeType, search, sortKey]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left type sidebar ─────────────────────────────────────────── */}
      <div className="hidden w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--border)] p-3 md:flex">
        <button
          onClick={() => setActiveType("all")}
          className={cn(
            "flex items-center justify-between rounded-[10px] px-3 py-2 text-sm transition-colors",
            activeType === "all"
              ? "bg-[var(--surface-raised)] text-[var(--text-main)]"
              : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-main)]"
          )}
        >
          <span>All</span>
          <span className="text-xs text-[var(--text-muted)]">{entities.length}</span>
        </button>
        {ALL_TYPES.map((t) => {
          const meta = TYPE_META[t];
          return (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={cn(
                "flex items-center justify-between rounded-[10px] px-3 py-2 text-sm transition-colors",
                activeType === t
                  ? "bg-[var(--surface-raised)] text-[var(--text-main)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-main)]"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: meta.color }}
                />
                <span>{meta.label}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{typeCounts[t] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* ── Main grid area ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar: search + sort */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entities…"
              className="w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSortKey(s)}
                className={cn(
                  "rounded-[10px] px-2.5 py-1.5 text-xs capitalize transition-colors",
                  sortKey === s
                    ? "bg-[var(--surface-raised)] text-[var(--text-main)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-heading text-5xl opacity-20">ᚷ</p>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No entities found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence>
                {filtered.map((entity, i) => (
                  <CodexCard
                    key={entity.id}
                    entity={entity}
                    relationshipCount={relCountById[entity.id] ?? 0}
                    hasSoul={soulEntityNames.has(entity.name.toLowerCase())}
                    isSelected={selectedEntityId === entity.id}
                    isSpotlit={spotlightEntityId === entity.id}
                    onClick={() =>
                      onSelectEntity(selectedEntityId === entity.id ? null : entity.id)
                    }
                    onCreateSoul={onCreateSoul}
                    canCreateSoul={canCreateSoul}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
