"use client";

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Network, LayoutGrid, GitBranch, ScrollText, Dices, Camera, RefreshCw, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/store";
import type { Entity, EntityRelationship, Soul } from "@/lib/types";
import { ConstellationCanvas } from "./constellation-canvas";
import { ConstellationDossier } from "./constellation-dossier";
import { ArchiveCodex } from "./archive-codex";
import { ArchiveWeb } from "./archive-web";
import { ArchiveScroll } from "./archive-scroll";
import { EntityCreateModal } from "./entity-create-modal";

type ArchiveViewMode = "constellation" | "codex" | "web" | "scroll";

interface ArchiveWorkspaceProps {
  worldId: string;
  entities: Entity[];
  relationships: EntityRelationship[];
  souls: Soul[];
  isReadonly?: boolean;
  isDemo?: boolean;
  isRefreshing?: boolean;
  refreshCount?: number;
  lastRefreshed?: string;
  onRefresh?: () => void;
  onForgeRelationship?: (rel: EntityRelationship) => void;
  onDeleteRelationship?: (id: string) => void;
  onCreateSoul?: (entityName: string) => void;
  canCreateSoul?: boolean;
  onEntityCreated?: (entity: Entity) => void;
  onEntityMerged?: (sourceId: string, updatedTarget: Entity) => void;
}

const VIEW_OPTIONS: { mode: ArchiveViewMode; icon: React.ElementType; label: string }[] = [
  { mode: "constellation", icon: Network, label: "Constellation" },
  { mode: "codex", icon: LayoutGrid, label: "Codex" },
  { mode: "web", icon: GitBranch, label: "Web" },
  { mode: "scroll", icon: ScrollText, label: "Scroll" },
];

export function ArchiveWorkspace({
  worldId,
  entities,
  relationships,
  souls,
  isReadonly = false,
  isDemo = false,
  isRefreshing = false,
  refreshCount = 0,
  lastRefreshed,
  onRefresh,
  onForgeRelationship,
  onDeleteRelationship,
  onCreateSoul,
  canCreateSoul = false,
  onEntityCreated,
  onEntityMerged,
}: ArchiveWorkspaceProps) {
  const [viewMode, setViewMode] = useState<ArchiveViewMode>("constellation");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  // Local selection for non-constellation views
  const [codexSelectedId, setCodexSelectedId] = useState<string | null>(null);
  const [spotlightEntityId, setSpotlightEntityId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas view uses the store (ConstellationDossier reads from there)
  const { setSelectedEntity } = useWorkspaceStore();

  // Random entity oracle — reveals a random entity
  const handleOracleReveal = useCallback(() => {
    if (entities.length === 0) return;
    const pick = entities[Math.floor(Math.random() * entities.length)];
    setSpotlightEntityId(pick.id);
    if (viewMode === "constellation") {
      setSelectedEntity(pick);
    } else if (viewMode === "codex") {
      setCodexSelectedId(pick.id);
    }
    setTimeout(() => setSpotlightEntityId(null), 1400);
  }, [entities, viewMode, setSelectedEntity]);

  // Capture constellation as PNG
  const handleCapture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "grimoire-constellation.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* ── Top toolbar ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        {/* Left: playfulness + refresh buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleOracleReveal}
            whileTap={{ scale: 0.95 }}
            title="Reveal a hidden soul"
            className="group flex items-center gap-1.5 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--accent)] active:scale-[0.97]"
          >
            <Dices className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-[20deg]" />
            <span className="hidden sm:inline">Reveal a soul</span>
          </motion.button>

          <AnimatePresence>
            {viewMode === "constellation" && (
              <motion.button
                onClick={handleCapture}
                whileTap={{ scale: 0.95 }}
                title="Capture the Constellation"
                className="flex items-center gap-1.5 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--ai-pulse)] active:scale-[0.97]"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Camera className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Capture</span>
              </motion.button>
            )}
          </AnimatePresence>

          {!isDemo && onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={lastRefreshed ? `Last refreshed: ${new Date(lastRefreshed).toLocaleTimeString()}` : undefined}
              className="flex items-center gap-1.5 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-main)] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-[var(--ai-pulse)]")} />
              <span className="hidden sm:inline">
                {isRefreshing ? "Refreshing…" : refreshCount > 0 ? `Refresh (+${refreshCount})` : "Refresh"}
              </span>
            </button>
          )}

          {!isReadonly && !isDemo && onEntityCreated && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-[var(--accent)] active:scale-[0.97] active:transition-none"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Entity</span>
            </button>
          )}
        </div>

        {/* Right: view mode switcher */}
        <div className="flex items-center gap-1 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-1">
          {VIEW_OPTIONS.map(({ mode, icon: Icon, label }) => (
            <motion.button
              key={mode}
              onClick={() => setViewMode(mode)}
              whileTap={{ scale: 0.94 }}
              title={label}
              className={cn(
                "relative rounded-[14px] p-2 transition-colors",
                viewMode === mode ? "text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              )}
            >
              {viewMode === mode && (
                <motion.div
                  layoutId="archive-view-indicator"
                  className="absolute inset-0 rounded-[14px] bg-[var(--surface-raised)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Entity create modal ───────────────────────────────────────── */}
      {onEntityCreated && (
        <EntityCreateModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          worldId={worldId}
          onEntityCreated={(entity) => {
            onEntityCreated(entity);
            setCreateModalOpen(false);
          }}
        />
      )}

      {/* ── View content ──────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            {viewMode === "constellation" && (
              <div className="relative h-full overflow-hidden rounded-[20px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_55%,transparent)]">
                <ConstellationCanvas
                  entities={entities}
                  relationships={relationships}
                  onForgeRelationship={onForgeRelationship}
                  spotlightEntityId={spotlightEntityId}
                  canvasExportRef={canvasRef}
                />
                <AnimatePresence>
                  <ConstellationDossier
                    worldId={worldId}
                    allEntities={entities}
                    relationships={relationships}
                    souls={souls}
                    isDemo={isDemo}
                    onDeleteRelationship={onDeleteRelationship}
                    onMergeComplete={onEntityMerged}
                  />
                </AnimatePresence>
              </div>
            )}

            {viewMode === "codex" && (
              <ArchiveCodex
                entities={entities}
                relationships={relationships}
                souls={souls}
                worldId={worldId}
                onSelectEntity={setCodexSelectedId}
                selectedEntityId={codexSelectedId}
                canCreateSoul={canCreateSoul && !isReadonly}
                onCreateSoul={onCreateSoul}
                spotlightEntityId={spotlightEntityId}
              />
            )}

            {viewMode === "web" && (
              <ArchiveWeb
                entities={entities}
                relationships={relationships}
                onSelectEntity={(id) => id}
                selectedEntityId={null}
              />
            )}

            {viewMode === "scroll" && (
              <ArchiveScroll
                entities={entities}
                relationships={relationships}
                souls={souls}
                worldId={worldId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
