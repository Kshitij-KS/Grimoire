"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import type { Entity, EntityType } from "@/lib/types";

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
}: {
  worldId: string;
  allEntities?: Entity[];
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

        {/* Related members for faction/location */}
        {relatedMembers.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">
              Associated Characters
            </p>
            <div className="flex flex-wrap gap-2">
              {relatedMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedEntity(m)}
                  className="rounded-full border px-3 py-1 text-xs transition-colors hover:opacity-80"
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
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(196,168,106,0.28)] bg-[rgba(196,168,106,0.1)] py-2.5 text-sm text-[rgb(236,221,182)] transition-colors hover:bg-[rgba(196,168,106,0.14)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Forge Soul from {selectedEntity.name}
          </button>
        ) : null}
      </div>
    </motion.aside>
  );
}
