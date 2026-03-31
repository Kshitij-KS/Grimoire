"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, X, Trash2, Link as LinkIcon } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import type { Entity, EntityType, EntityRelationship } from "@/lib/types";

const TYPE_COLORS: Record<EntityType, string> = {
  character: "#C4A86A",
  location: "#A594FF",
  faction: "#D25A5A",
  artifact: "#C3CBEC",
  event: "#7E6DF2",
  rule: "#7C86A8",
};

const TYPE_LABELS: Record<EntityType, string> = {
  character: "Character",
  location: "Location",
  faction: "Faction",
  artifact: "Artifact",
  event: "Event",
  rule: "World Rule",
};

export function ConstellationDossier({
  worldId: _worldId, // eslint-disable-line @typescript-eslint/no-unused-vars
  allEntities = [],
  relationships = [],
  onDeleteRelationship,
}: {
  worldId: string;
  allEntities?: Entity[];
  relationships?: EntityRelationship[];
  onDeleteRelationship?: (id: string) => void;
}) {
  const { selectedEntity, setSelectedEntity, setForgeSoulName } = useWorkspaceStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEntity(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSelectedEntity]);

  if (!selectedEntity) return null;

  const accentColor = TYPE_COLORS[selectedEntity.type] ?? "#E0E0E0";

  // For faction/location: find character entities that mention this entity
  const relatedMembers =
    selectedEntity.type === "faction" || selectedEntity.type === "location"
      ? allEntities.filter(
          (e) =>
            e.type === "character" &&
            e.id !== selectedEntity.id &&
            ((e.summary ?? "").toLowerCase().includes(selectedEntity.name.toLowerCase()) ||
              (selectedEntity.summary ?? "").toLowerCase().includes(e.name.toLowerCase())),
        )
      : [];

  const explicitRelationships = relationships.filter(
    (r) => r.source_entity_id === selectedEntity.id || r.target_entity_id === selectedEntity.id
  );

  const handleForgeSoul = () => {
    setForgeSoulName(selectedEntity.name);
    setSelectedEntity(null);
    router.push(`${pathname}?section=souls`);
  };

  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="glass-panel-elevated fixed inset-y-4 left-4 z-40 flex w-[min(92vw,400px)] flex-col overflow-hidden rounded-[28px]"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-6 pb-4">
        <div className="min-w-0 flex-1">
          <p
            className="mb-1 text-[10px] uppercase tracking-[0.2em]"
            style={{ color: accentColor + "99" }}
          >
            {TYPE_LABELS[selectedEntity.type] ?? selectedEntity.type}
          </p>
          <h2 className="truncate font-heading text-4xl leading-tight text-foreground">
            {selectedEntity.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setSelectedEntity(null)}
          className="ml-3 mt-1 rounded-full p-1.5 text-secondary transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Accent line */}
      <div className="mx-6 h-px" style={{ backgroundColor: accentColor + "33" }} />

      {/* Scrollable content */}
      <div className="flex-1 space-y-5 overflow-y-auto p-6 pt-4">
        {selectedEntity.summary ? (
          <p className="text-sm leading-7 text-secondary">{selectedEntity.summary}</p>
        ) : (
          <p className="text-sm italic text-secondary">No summary recorded.</p>
        )}

        {selectedEntity.mention_count ? (
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">
            Mentioned {selectedEntity.mention_count}{" "}
            {selectedEntity.mention_count === 1 ? "time" : "times"}
          </p>
        ) : null}

        {/* Web of Influence */}
        {explicitRelationships.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent)] font-bold">
                Web of Influence
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {explicitRelationships.map((rel) => {
                const isSource = rel.source_entity_id === selectedEntity.id;
                const otherId = isSource ? rel.target_entity_id : rel.source_entity_id;
                const otherEntity = allEntities.find((e) => e.id === otherId);
                if (!otherEntity) return null;

                return (
                  <div key={rel.id} className="group relative flex items-center justify-between rounded-xl border border-border/60 bg-black/20 px-4 py-3 hover:border-[var(--accent)]/50 transition duration-300">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: TYPE_COLORS[otherEntity.type], color: TYPE_COLORS[otherEntity.type] }} />
                      <div>
                        <p className="text-xs text-secondary opacity-70 mb-0.5 uppercase tracking-wider">{isSource ? "You → " : "← "}{rel.label}</p>
                        <button 
                          onClick={() => setSelectedEntity(otherEntity)}
                          className="font-heading text-lg hover:text-[var(--accent)] transition text-foreground"
                        >
                          {otherEntity.name}
                        </button>
                      </div>
                    </div>
                    {onDeleteRelationship && (
                      <button 
                         onClick={async () => {
                           try {
                             await fetch(`/api/relationships`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: rel.id }) });
                             onDeleteRelationship(rel.id);
                           } catch (err) {
                             console.error("Failed to delete", err);
                           }
                         }}
                         className="opacity-0 group-hover:opacity-100 p-2 transition text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-lg outline-none cursor-pointer"
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
        ) : null}

        {/* Related members for faction/location */}
        {relatedMembers.length > 0 ? (
          <div className="space-y-3 pt-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">
              Implicit Members
            </p>
            <div className="flex flex-wrap gap-2">
              {relatedMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedEntity(m)}
                  className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:scale-105"
                  style={{
                    borderColor: accentColor + "44",
                    color: accentColor,
                    background: accentColor + "12",
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Lore fragments */}
        {selectedEntity.lore_chunks && selectedEntity.lore_chunks.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">
              Lore Fragments
            </p>
            {selectedEntity.lore_chunks.slice(0, 5).map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-[16px] border border-border bg-[rgba(255,255,255,0.025)] p-3"
              >
                <p className="line-clamp-3 text-xs leading-6 text-secondary">{chunk.content}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Forge Soul CTA for characters */}
        {selectedEntity.type === "character" ? (
          <button
            type="button"
            onClick={handleForgeSoul}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] py-2.5 text-sm text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Forge Soul from {selectedEntity.name}
          </button>
        ) : null}
      </div>
    </motion.aside>
  );
}
