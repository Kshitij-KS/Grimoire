"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Network, LayoutGrid, GitBranch, Dices, Camera, RefreshCw, Plus, ArrowLeft, X, ArrowRight, Users, GitFork, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/store";
import type { Entity, EntityRelationship, EntityType, Soul } from "@/lib/types";
import { ConstellationCanvas } from "./constellation-canvas";
import { ConstellationDossier } from "./constellation-dossier";
import { ArchiveCodex } from "./archive-codex";
import { ArchiveWeb } from "./archive-web";
import { ArchiveScroll } from "./archive-scroll";
import { EntityCreateModal } from "./entity-create-modal";

// ── Oracle Spotlight ─────────────────────────────────────────────────────────
const TYPE_LABELS: Record<EntityType, string> = {
  character: "Character",
  location:  "Location",
  faction:   "Faction",
  artifact:  "Artifact",
  event:     "Event",
  rule:      "World Rule",
};

const TYPE_COLORS: Record<EntityType, string> = {
  character: "var(--accent)",
  location:  "var(--ai-pulse)",
  faction:   "var(--danger)",
  artifact:  "var(--accent-soft)",
  event:     "var(--success)",
  rule:      "var(--text-muted)",
};

const DISMISS_MS = 6000;

function OracleSpotlight({
  entity,
  relationships,
  souls,
  onOpen,
  onClose,
}: {
  entity: Entity;
  relationships: EntityRelationship[];
  souls: Soul[];
  onOpen: (entity: Entity) => void;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(1, elapsed / DISMISS_MS));
      if (elapsed < DISMISS_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        onClose();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const relCount = relationships.filter(
    (r) => r.source_entity_id === entity.id || r.target_entity_id === entity.id
  ).length;

  const entityNameLower = entity.name.toLowerCase();
  const boundSouls = souls.filter(
    (s) => s.name.toLowerCase() === entityNameLower ||
           s.name.toLowerCase().includes(entityNameLower) ||
           entityNameLower.includes(s.name.toLowerCase())
  );

  const typeColor = TYPE_COLORS[entity.type] ?? "var(--accent)";
  const circ = 2 * Math.PI * 18;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 z-40 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        className="absolute inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] shadow-[0_24px_64px_color-mix(in_srgb,var(--bg)_50%,transparent)]"
        initial={{ scale: 0.88, opacity: 0, y: "-40%" }}
        animate={{ scale: 1, opacity: 1, y: "-50%" }}
        exit={{ scale: 0.92, opacity: 0, y: "-44%" }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header row */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
                color: typeColor,
              }}
            >
              {TYPE_LABELS[entity.type]}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] opacity-60">
              Oracle&apos;s Revelation
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] active:scale-[0.95] active:transition-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Name */}
        <div className="px-4 pb-3">
          <h2 className="font-heading text-3xl leading-tight text-[var(--text-main)]">
            {entity.name}
          </h2>
        </div>

        {/* Summary */}
        {entity.summary && (
          <div className="px-4 pb-3">
            <p className="line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
              {entity.summary}
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] px-3 py-2">
          {entity.mention_count != null && entity.mention_count > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <BookOpen className="h-3 w-3" style={{ color: typeColor }} />
              <span>{entity.mention_count} mention{entity.mention_count !== 1 ? "s" : ""}</span>
            </div>
          )}
          {relCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <GitFork className="h-3 w-3 text-[var(--ai-pulse)]" />
              <span>{relCount} connection{relCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          {boundSouls.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <Users className="h-3 w-3 text-[var(--success)]" />
              <span>{boundSouls.length} soul{boundSouls.length !== 1 ? "s" : ""} bound</span>
            </div>
          )}
          {relCount === 0 && (entity.mention_count == null || entity.mention_count === 0) && boundSouls.length === 0 && (
            <span className="text-[11px] italic text-[var(--text-muted)] opacity-60">No connections yet</span>
          )}
        </div>

        {/* Footer: progress + open button */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
          {/* Countdown ring */}
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 44 44" className="-rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="color-mix(in srgb, var(--border) 80%, transparent)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke="color-mix(in srgb, var(--text-muted) 50%, transparent)"
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * progress}
                style={{ transition: "stroke-dashoffset 0.05s linear" }}
              />
            </svg>
            <span className="text-[10px] text-[var(--text-muted)] opacity-60">
              {Math.ceil((1 - progress) * (DISMISS_MS / 1000))}s
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpen(entity)}
            className="flex items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] active:scale-[0.97] active:transition-none"
          >
            Open in Archive
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </>
  );
}

type ArchiveViewMode = "constellation" | "codex" | "web";

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

const SPLIT_VIEW_OPTIONS: { mode: ArchiveViewMode; icon: React.ElementType; label: string }[] = [
  { mode: "codex",         icon: LayoutGrid, label: "Codex" },
  { mode: "web",           icon: GitBranch,  label: "Web"   },
  { mode: "constellation", icon: Network,    label: "Stars" },
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
  const [viewMode, setViewMode] = useState<ArchiveViewMode>("codex");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [spotlightEntityId, setSpotlightEntityId] = useState<string | null>(null);
  const [oracleEntity, setOracleEntity] = useState<Entity | null>(null);
  // Entity selected in the left navigation panel — drives the right scroll panel
  const [splitSelectedId, setSplitSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { setSelectedEntity } = useWorkspaceStore();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // When view mode changes, clear split selection
  const handleSetViewMode = (mode: ArchiveViewMode) => {
    setViewMode(mode);
    setSplitSelectedId(null);
  };

  // Random entity oracle — shows spotlight overlay in all views
  const handleOracleReveal = useCallback(() => {
    if (entities.length === 0) return;
    const pick = entities[Math.floor(Math.random() * entities.length)];
    setSpotlightEntityId(pick.id);
    setOracleEntity(pick);
    setTimeout(() => setSpotlightEntityId(null), 1400);
  }, [entities]);

  // Called when user clicks "Open in Archive" inside the Oracle overlay
  const handleOracleOpen = useCallback((entity: Entity) => {
    setOracleEntity(null);
    if (viewMode === "constellation") {
      setSelectedEntity(entity);
    } else {
      setSplitSelectedId(entity.id);
    }
  }, [viewMode, setSelectedEntity]);

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

  // Filtered entities for the right scroll panel: selected entity + direct 1-hop relations
  const scrollEntities = useMemo(() => {
    if (!splitSelectedId) return entities;
    const relatedIds = new Set<string>();
    relatedIds.add(splitSelectedId);
    for (const r of relationships) {
      if (r.source_entity_id === splitSelectedId) relatedIds.add(r.target_entity_id);
      if (r.target_entity_id === splitSelectedId) relatedIds.add(r.source_entity_id);
    }
    return entities.filter((e) => relatedIds.has(e.id));
  }, [splitSelectedId, entities, relationships]);

  const scrollRelationships = useMemo(() => {
    if (!splitSelectedId) return relationships;
    return relationships.filter(
      (r) => r.source_entity_id === splitSelectedId || r.target_entity_id === splitSelectedId
    );
  }, [splitSelectedId, relationships]);

  const selectedEntityName = useMemo(
    () => entities.find((e) => e.id === splitSelectedId)?.name ?? "",
    [entities, splitSelectedId]
  );

  const isConstellationMode = viewMode === "constellation";
  const showRightPanel = !!splitSelectedId && !isConstellationMode;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* ── Top toolbar ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        {/* Left: utility buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleOracleReveal}
            whileTap={{ scale: 0.95 }}
            title="Reveal a random entity"
            className="group flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--accent)] active:scale-[0.97]"
          >
            <Dices className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-[20deg]" />
            <span className="hidden sm:inline">Reveal a soul</span>
          </motion.button>

          <AnimatePresence>
            {isConstellationMode && (
              <motion.button
                onClick={handleCapture}
                whileTap={{ scale: 0.95 }}
                title="Capture the Constellation"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--ai-pulse)] active:scale-[0.97]"
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
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-main)] disabled:opacity-50"
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
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-[var(--accent)] active:scale-[0.97] active:transition-none"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Entity</span>
            </button>
          )}
        </div>

        {/* Right: view mode switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {SPLIT_VIEW_OPTIONS.map(({ mode, icon: Icon, label }) => (
            <motion.button
              key={mode}
              onClick={() => handleSetViewMode(mode)}
              whileTap={{ scale: 0.94 }}
              title={label}
              className={cn(
                "relative rounded-lg p-2 transition-colors",
                viewMode === mode ? "text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              )}
            >
              {viewMode === mode && (
                <motion.div
                  layoutId="archive-view-indicator"
                  className="absolute inset-0 rounded-lg bg-[var(--surface-raised)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Entity create modal */}
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
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Oracle Spotlight overlay — consistent across all view modes */}
        <AnimatePresence>
          {oracleEntity && (
            <OracleSpotlight
              key={oracleEntity.id}
              entity={oracleEntity}
              relationships={relationships}
              souls={souls}
              onOpen={handleOracleOpen}
              onClose={() => setOracleEntity(null)}
            />
          )}
        </AnimatePresence>

        {/* Constellation — full-screen (unchanged) */}
        <AnimatePresence mode="wait">
          {isConstellationMode && (
            <motion.div
              key="constellation"
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_55%,transparent)]"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Split-view — Codex or Web on left, Scroll on right */}
        {!isConstellationMode && (
          <div className="absolute inset-0 flex overflow-hidden">
            {/* Left: navigation/macro panel */}
            <motion.div
              layout
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                "relative flex min-w-0 flex-col overflow-hidden",
                showRightPanel && !isMobile ? "w-[45%]" : "flex-1"
              )}
            >
              <AnimatePresence mode="wait">
                {viewMode === "codex" && (
                  <motion.div
                    key="codex"
                    initial={{ opacity: 0, filter: "blur(3px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(3px)" }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0"
                  >
                    <ArchiveCodex
                      entities={entities}
                      relationships={relationships}
                      souls={souls}
                      worldId={worldId}
                      onSelectEntity={(id) => setSplitSelectedId(id)}
                      selectedEntityId={splitSelectedId}
                      canCreateSoul={canCreateSoul && !isReadonly}
                      onCreateSoul={onCreateSoul}
                      spotlightEntityId={spotlightEntityId}
                    />
                  </motion.div>
                )}
                {viewMode === "web" && (
                  <motion.div
                    key="web"
                    initial={{ opacity: 0, filter: "blur(3px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(3px)" }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0"
                  >
                    <ArchiveWeb
                      entities={entities}
                      relationships={relationships}
                      onSelectEntity={(id) => setSplitSelectedId(id)}
                      selectedEntityId={splitSelectedId}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Right: entity detail scroll panel */}
            <AnimatePresence>
              {showRightPanel && (
                <motion.div
                  key="scroll-panel"
                  initial={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                  animate={isMobile ? { x: 0 } : { width: "55%", opacity: 1 }}
                  exit={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  className={cn(
                    "flex flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)]",
                    isMobile && "absolute inset-0 z-30"
                  )}
                >
                  {/* Panel header */}
                  <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setSplitSelectedId(null)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--text-main)_5%,transparent)] hover:text-[var(--text-main)] active:scale-[0.97] active:transition-none"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Back</span>
                    </button>
                    <div className="h-4 w-px bg-[var(--border)]" />
                    <p className="truncate font-heading text-sm text-[var(--text-main)]">{selectedEntityName}</p>
                  </div>

                  {/* Filtered scroll view */}
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <ArchiveScroll
                      entities={scrollEntities}
                      relationships={scrollRelationships}
                      souls={souls}
                      worldId={worldId}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
