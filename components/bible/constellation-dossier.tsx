"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, X, Trash2, Link as LinkIcon, ChevronRight, Pencil, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import type { Entity, EntityType, EntityRelationship, Soul } from "@/lib/types";

const TYPE_COLORS: Record<EntityType, string> = {
  character: "var(--accent)",
  location:  "var(--ai-pulse)",
  faction:   "var(--danger)",
  artifact:  "var(--accent-soft)",
  event:     "var(--success)",
  rule:      "var(--text-muted)",
};

const TYPE_LABELS: Record<EntityType, string> = {
  character: "Character",
  location: "Location",
  faction: "Faction",
  artifact: "Artifact",
  event: "Event",
  rule: "World Rule",
};

// ── Expandable lore fragment ──────────────────────────────────────────────

function LoreFragment({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 220;
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] p-3">
      <p className={`text-xs leading-6 text-[var(--text-muted)] ${!expanded && isLong ? "line-clamp-3" : ""}`}>
        {content}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Collapse" : "Read more"}
        </button>
      )}
    </div>
  );
}

export function ConstellationDossier({
  worldId: _worldId, // eslint-disable-line @typescript-eslint/no-unused-vars
  allEntities = [],
  relationships = [],
  souls = [],
  onDeleteRelationship,
}: {
  worldId: string;
  allEntities?: Entity[];
  relationships?: EntityRelationship[];
  souls?: Soul[];
  onDeleteRelationship?: (id: string) => void;
}) {
  const { selectedEntity, setSelectedEntity, setForgeSoulName } = useWorkspaceStore();
  const router = useRouter();
  const pathname = usePathname();

  // Entity navigation history — last 3 visited
  const historyRef = useRef<Entity[]>([]);
  const [, forceRender] = useState(0);

  // Inline edit state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Track history when selectedEntity changes
  useEffect(() => {
    if (!selectedEntity) return;
    const history = historyRef.current;
    if (history[history.length - 1]?.id !== selectedEntity.id) {
      historyRef.current = [...history.slice(-2), selectedEntity];
      forceRender((n) => n + 1);
    }
  }, [selectedEntity]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingName) { setEditingName(false); return; }
        setSelectedEntity(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSelectedEntity, editingName]);

  if (!selectedEntity) return null;

  const accentColor = TYPE_COLORS[selectedEntity.type] ?? "var(--text-muted)";
  const breadcrumbs = historyRef.current.slice(0, -1); // All except current

  const relatedMembers =
    selectedEntity.type === "faction" || selectedEntity.type === "location"
      ? allEntities.filter(
          (e) =>
            e.type === "character" &&
            e.id !== selectedEntity.id &&
            ((e.summary ?? "").toLowerCase().includes(selectedEntity.name.toLowerCase()) ||
              (selectedEntity.summary ?? "").toLowerCase().includes(e.name.toLowerCase()))
        )
      : [];

  const explicitRelationships = relationships.filter(
    (r) => r.source_entity_id === selectedEntity.id || r.target_entity_id === selectedEntity.id
  );

  // Check if this entity already has a soul
  const hasSoul = souls.some((s) => s.name.toLowerCase() === selectedEntity.name.toLowerCase());

  const handleForgeSoul = () => {
    setForgeSoulName(selectedEntity.name);
    setSelectedEntity(null);
    router.push(`${pathname}?section=souls`);
  };

  const startEdit = () => {
    setEditName(selectedEntity.name);
    setEditingName(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEdit = async () => {
    setEditingName(false);
    const trimmed = editName.trim();
    if (!trimmed || trimmed === selectedEntity.name) return;
    try {
      await fetch(`/api/entities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedEntity.id, name: trimmed }),
      });
    } catch (e) {
      console.error("Failed to save entity name:", e);
    }
  };

  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="glass-panel-elevated absolute inset-y-4 left-4 z-40 flex w-[min(92vw,390px)] flex-col overflow-hidden rounded-[28px]"
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb history */}
          {breadcrumbs.length > 0 && (
            <div className="mb-2 flex items-center gap-1 overflow-x-auto">
              {breadcrumbs.map((e, i) => (
                <div key={e.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-[var(--text-muted)] opacity-50" />}
                  <button
                    onClick={() => setSelectedEntity(e)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    style={{ background: `color-mix(in srgb, ${TYPE_COLORS[e.type]} 10%, transparent)` }}
                  >
                    {e.name.length > 14 ? e.name.slice(0, 12) + "…" : e.name}
                  </button>
                </div>
              ))}
              <ChevronRight className="h-3 w-3 text-[var(--text-muted)] opacity-50" />
            </div>
          )}

          <p className="mb-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: `color-mix(in srgb, ${accentColor} 80%, transparent)` }}>
            {TYPE_LABELS[selectedEntity.type] ?? selectedEntity.type}
          </p>

          {/* Inline-editable name */}
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                ref={editInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="min-w-0 flex-1 bg-transparent font-heading text-3xl text-[var(--text-main)] outline-none border-b border-[var(--border-focus)]"
              />
              <button onClick={saveEdit} className="shrink-0 text-[var(--accent)]">
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="group flex items-start gap-2">
              <h2 className="truncate font-heading text-4xl leading-tight text-[var(--text-main)]">
                {selectedEntity.name}
              </h2>
              <button
                onClick={startEdit}
                title="Edit name"
                className="mt-2 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
              >
                <Pencil className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedEntity(null)}
          className="ml-3 mt-1 rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--border)_50%,transparent)] hover:text-[var(--text-main)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Accent divider */}
      <div className="mx-5 h-px" style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 30%, transparent)` }} />

      {/* ── Scrollable content ───────────────────────────────────────── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5 pt-4">
        {selectedEntity.summary ? (
          <p className="text-sm leading-7 text-[var(--text-muted)]">{selectedEntity.summary}</p>
        ) : (
          <p className="text-sm italic text-[var(--text-muted)] opacity-50">No summary recorded.</p>
        )}

        {(selectedEntity.mention_count ?? 0) > 0 && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Mentioned {selectedEntity.mention_count}{" "}
            {selectedEntity.mention_count === 1 ? "time" : "times"}
          </p>
        )}

        {/* Web of Influence */}
        {explicitRelationships.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                Web of Influence
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {explicitRelationships.map((rel) => {
                const isSource = rel.source_entity_id === selectedEntity.id;
                const otherId = isSource ? rel.target_entity_id : rel.source_entity_id;
                const otherEntity = allEntities.find((e) => e.id === otherId);
                if (!otherEntity) return null;
                const otherColor = TYPE_COLORS[otherEntity.type];

                return (
                  <div
                    key={rel.id}
                    className="group relative flex items-center justify-between rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] px-3.5 py-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: otherColor }}
                      />
                      <div>
                        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] opacity-70">
                          {isSource ? "→ " : "← "}{rel.label}
                        </p>
                        <button
                          onClick={() => setSelectedEntity(otherEntity)}
                          className="font-heading text-lg text-[var(--text-main)] transition-colors hover:text-[var(--accent)]"
                        >
                          {otherEntity.name}
                        </button>
                      </div>
                    </div>
                    {onDeleteRelationship && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch(`/api/relationships`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "delete", id: rel.id }),
                            });
                            onDeleteRelationship(rel.id);
                          } catch (err) {
                            console.error("Failed to delete relationship", err);
                          }
                        }}
                        className="rounded-lg p-1.5 text-[var(--danger)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                        title="Sever Link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Related members for faction/location */}
        {relatedMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Implicit Members
            </p>
            <div className="flex flex-wrap gap-1.5">
              {relatedMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedEntity(m)}
                  className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:scale-105"
                  style={{
                    borderColor: `color-mix(in srgb, ${accentColor} 40%, transparent)`,
                    color: accentColor,
                    background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lore fragments (expandable) */}
        {selectedEntity.lore_chunks && selectedEntity.lore_chunks.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Lore Fragments
            </p>
            {selectedEntity.lore_chunks.slice(0, 5).map((chunk) => (
              <LoreFragment key={chunk.id} content={chunk.content} />
            ))}
          </div>
        )}

        {/* Forge Soul CTA */}
        {selectedEntity.type === "character" && !hasSoul && (
          <button
            type="button"
            onClick={handleForgeSoul}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] py-2.5 text-sm text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] active:scale-[0.97] active:transition-none"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Forge Soul from {selectedEntity.name}
          </button>
        )}

        {selectedEntity.type === "character" && hasSoul && (
          <p className="text-center text-xs text-[var(--text-muted)]">
            <span style={{ color: "var(--ai-pulse)" }}>✦</span> Soul already bound
          </p>
        )}
      </div>
    </motion.aside>
  );
}
