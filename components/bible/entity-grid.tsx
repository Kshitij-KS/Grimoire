"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityCard } from "@/components/bible/entity-card";
import { EntityDetailPanel } from "@/components/bible/entity-detail-panel";
import { SoulCreationModal } from "@/components/souls/soul-creation-modal";
import { useWorkspaceStore } from "@/lib/store";
import type { Entity, EntityType, Soul } from "@/lib/types";

const tabMap = [
  ["character", "Characters"],
  ["location", "Locations"],
  ["faction", "Factions"],
  ["artifact", "Artifacts"],
  ["event", "Events"],
  ["rule", "World Rules"],
] as const;

export function EntityGrid({
  entities,
  souls,
  worldId,
  onSoulCreated,
}: {
  entities: Entity[];
  souls: Soul[];
  worldId?: string;
  onSoulCreated?: (soul: Soul) => void;
}) {
  const { selectedEntity, setSelectedEntity } = useWorkspaceStore();
  const [soulModalOpen, setSoulModalOpen] = useState(false);
  const [soulModalName, setSoulModalName] = useState("");
  const [activeTab, setActiveTab] = useState<EntityType>("character");
  const createableSoulCount = Math.max(0, 3 - souls.length);

  const grouped = useMemo(
    () =>
      tabMap.reduce<Record<string, Entity[]>>((acc, [type]) => {
        acc[type] = entities.filter((entity) => entity.type === type);
        return acc;
      }, {}),
    [entities],
  );

  const handleCreateSoulFromEntity = (name: string) => {
    setSoulModalName(name);
    setSoulModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        {/* ── Custom tab bar with sliding indicator ── */}
        <div className="relative flex flex-wrap gap-1 border-b border-border pb-0">
          {tabMap.map(([type, label]) => {
            const count = grouped[type].length;
            const isActive = activeTab === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveTab(type as EntityType)}
                className="relative px-4 py-2.5 text-sm transition-colors duration-150"
                style={{ color: isActive ? "rgb(230,233,245)" : "var(--text-secondary)" }}
              >
                <span className="flex items-center gap-1.5">
                  {label}
                  {count > 0 && (
                    <span className="rounded-full bg-[rgba(212,168,83,0.15)] px-1.5 py-0.5 text-[10px] text-[rgb(212,168,83)]">
                      {count}
                    </span>
                  )}
                </span>
                {/* Sliding bottom indicator */}
                {isActive && (
                  <motion.div
                    layoutId="entity-tab-line"
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ background: "rgb(212,168,83)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content with directional slide transition ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {grouped[activeTab].length === 0 ? (
              <EmptyState
                variant="archive"
                title={`No ${tabMap.find(([t]) => t === activeTab)?.[1].toLowerCase()} in the archive yet.`}
                description="Write more lore — entities will emerge from your words automatically."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {grouped[activeTab].map((entity, i) => (
                  <motion.div
                    key={entity.id}
                    initial={{ opacity: 0, x: -16, filter: "blur(4px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.2, delay: i * 0.06, ease: "easeOut" }}
                  >
                    <EntityCard entity={entity} onClick={() => setSelectedEntity(entity)} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedEntity ? (
          <EntityDetailPanel
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
            canCreateSoul={createableSoulCount > 0}
            onCreateSoul={handleCreateSoulFromEntity}
          />
        ) : null}
      </AnimatePresence>

      {worldId ? (
        <SoulCreationModal
          open={soulModalOpen}
          onOpenChange={setSoulModalOpen}
          worldId={worldId}
          onCreated={(soul) => {
            if (soul && onSoulCreated) onSoulCreated(soul);
          }}
          prefillName={soulModalName}
        />
      ) : null}
    </>
  );
}
