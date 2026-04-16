"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, User, MapPin, Users, Gem, Calendar, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Entity, EntityRelationship, EntityType } from "@/lib/types";

// ── Type colors ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<EntityType, string> = {
  character: "var(--accent)",
  location:  "var(--ai-pulse)",
  faction:   "var(--danger)",
  artifact:  "var(--accent-soft)",
  event:     "var(--success)",
  rule:      "var(--text-muted)",
};

const TYPE_ICONS: Record<EntityType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  character: User,
  location:  MapPin,
  faction:   Users,
  artifact:  Gem,
  event:     Calendar,
  rule:      BookOpen,
};

// ── Force layout hook ──────────────────────────────────────────────────────

interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function useForceLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  w: number,
  h: number
): ForceNode[] {
  const [positions, setPositions] = useState<ForceNode[]>([]);
  const ticksRef = useRef(0);

  useEffect(() => {
    if (nodeIds.length === 0 || w === 0 || h === 0) return;

    // Initial circle layout
    const nodes: ForceNode[] = nodeIds.map((id, i) => {
      const angle = (i / nodeIds.length) * Math.PI * 2;
      const radius = Math.min(w, h) * 0.35;
      return {
        id,
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    const REPEL = 2800;
    const ATTRACT = 0.04;
    const DAMPING = 0.75;
    const CENTER = 0.02;
    const TICKS = 80;

    const edgeSet = edges.map((e) => ({ src: e.source, tgt: e.target }));

    for (let tick = 0; tick < TICKS; tick++) {
      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist2 = Math.max(dx * dx + dy * dy, 1);
          const dist = Math.sqrt(dist2);
          const force = REPEL / dist2;
          const nx = (dx / dist) * force;
          const ny = (dy / dist) * force;
          nodes[i].vx -= nx;
          nodes[i].vy -= ny;
          nodes[j].vx += nx;
          nodes[j].vy += ny;
        }
      }

      // Edge attraction
      for (const edge of edgeSet) {
        const src = nodes.find((n) => n.id === edge.src);
        const tgt = nodes.find((n) => n.id === edge.tgt);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        src.vx += dx * ATTRACT;
        src.vy += dy * ATTRACT;
        tgt.vx -= dx * ATTRACT;
        tgt.vy -= dy * ATTRACT;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (w / 2 - n.x) * CENTER;
        n.vy += (h / 2 - n.y) * CENTER;
      }

      // Integrate + damping + bounds
      for (const n of nodes) {
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(48, Math.min(w - 48, n.x));
        n.y = Math.max(48, Math.min(h - 48, n.y));
      }
    }

    ticksRef.current = TICKS;
    setPositions([...nodes]);
  }, [nodeIds.join(","), edges.length, w, h]); // eslint-disable-line react-hooks/exhaustive-deps

  return positions;
}

// ── Mobile list view ───────────────────────────────────────────────────────

function MobileWebList({
  entities,
  relationships,
  onSelectEntity,
  selectedEntityId,
}: {
  entities: Entity[];
  relationships: EntityRelationship[];
  onSelectEntity: (id: string | null) => void;
  selectedEntityId: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build a lookup: entity id → related entities
  const relMap: Record<string, { entity: Entity; label: string }[]> = {};
  for (const r of relationships) {
    const src = entities.find((e) => e.id === r.source_entity_id);
    const tgt = entities.find((e) => e.id === r.target_entity_id);
    if (src && tgt) {
      if (!relMap[src.id]) relMap[src.id] = [];
      if (!relMap[tgt.id]) relMap[tgt.id] = [];
      relMap[src.id].push({ entity: tgt, label: r.label });
      relMap[tgt.id].push({ entity: src, label: r.label });
    }
  }

  // Group entities by type
  const grouped: Partial<Record<EntityType, Entity[]>> = {};
  for (const e of entities) {
    if (!grouped[e.type]) grouped[e.type] = [];
    grouped[e.type]!.push(e);
  }

  const typeOrder: EntityType[] = ["character", "location", "faction", "artifact", "event", "rule"];

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    onSelectEntity(id);
  };

  return (
    <div className="space-y-4 overflow-y-auto pb-4">
      {typeOrder.map((type) => {
        const group = grouped[type];
        if (!group || group.length === 0) return null;
        const color = TYPE_COLORS[type];
        const Icon = TYPE_ICONS[type];
        return (
          <div key={type}>
            {/* Type header */}
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <Icon className="h-3.5 w-3.5" style={{ color }} />
              <span className="chapter-label text-[10px] uppercase tracking-widest" style={{ color }}>
                {type}
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{
                  background: `color-mix(in srgb, ${color} 12%, transparent)`,
                  color,
                }}
              >
                {group.length}
              </span>
            </div>

            {/* Entity rows */}
            <div className="space-y-1">
              {group.map((entity) => {
                const rels = relMap[entity.id] ?? [];
                const isExpanded = expandedId === entity.id;
                const isSelected = selectedEntityId === entity.id;

                return (
                  <div key={entity.id}>
                    <button
                      type="button"
                      onClick={() => toggle(entity.id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] active:transition-none",
                        isSelected
                          ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-[color-mix(in_srgb,var(--border-focus)_60%,transparent)]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="truncate text-sm font-medium text-[var(--text-main)]">
                            {entity.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pl-2 shrink-0">
                          {rels.length > 0 && (
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                                color,
                              }}
                            >
                              {rels.length}
                            </span>
                          )}
                          {rels.length > 0 && (
                            <ChevronDown
                              className="h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200"
                              style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                            />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Inline relationship accordion */}
                    <AnimatePresence>
                      {isExpanded && rels.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 mt-1 space-y-1 border-l-2 border-[var(--border)] pl-3 pb-1">
                            {rels.map(({ entity: rel, label }, i) => {
                              const relColor = TYPE_COLORS[rel.type];
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => onSelectEntity(rel.id)}
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)] active:scale-[0.97] active:transition-none"
                                >
                                  <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ background: relColor }}
                                  />
                                  <span className="text-xs text-[var(--text-muted)]">{label}</span>
                                  <span className="ml-auto text-xs font-medium text-[var(--text-main)]">
                                    {rel.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface ArchiveWebProps {
  entities: Entity[];
  relationships: EntityRelationship[];
  onSelectEntity: (id: string | null) => void;
  selectedEntityId: string | null;
}

export function ArchiveWeb({
  entities,
  relationships,
  onSelectEntity,
  selectedEntityId,
}: ArchiveWebProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<{ x: number; y: number; label: string } | null>(null);

  // Only show entities with at least one relationship
  const connectedIds = new Set(
    relationships.flatMap((r) => [r.source_entity_id, r.target_entity_id])
  );
  const visibleEntities = entities.filter((e) => connectedIds.has(e.id));

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const nodeIds = visibleEntities.map((e) => e.id);
  const edges = relationships.map((r) => ({ source: r.source_entity_id, target: r.target_entity_id }));
  const positions = useForceLayout(nodeIds, edges, size.w, size.h);

  const posMap = Object.fromEntries(positions.map((p) => [p.id, p]));

  const handleEdgeMouseEnter = useCallback(
    (r: EntityRelationship, x: number, y: number) => {
      setHoveredEdgeId(r.id);
      setEdgeTooltip({ x, y, label: r.label });
    },
    []
  );

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
    setEdgeTooltip(null);
  }, []);

  if (visibleEntities.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="font-heading text-6xl opacity-20">ᚲ</p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No entity relationships have been forged yet.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)] opacity-60">
          Drag between entities in the Constellation to create links.
        </p>
      </div>
    );
  }

  // Mobile: grouped list view
  if (isMobile) {
    return (
      <div className="h-full overflow-y-auto px-2 pt-2">
        <MobileWebList
          entities={visibleEntities}
          relationships={relationships}
          onSelectEntity={onSelectEntity}
          selectedEntityId={selectedEntityId}
        />
      </div>
    );
  }

  // Desktop: force-directed SVG graph
  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ touchAction: "none" }}>
      {/* SVG edges */}
      {size.w > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="4"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L0,6 L8,3 z"
                fill="color-mix(in srgb, var(--border-focus) 70%, transparent)"
              />
            </marker>
          </defs>
          {relationships.map((r) => {
            const src = posMap[r.source_entity_id];
            const tgt = posMap[r.target_entity_id];
            if (!src || !tgt) return null;
            const isHighlighted =
              hoveredEdgeId === r.id ||
              selectedEntityId === r.source_entity_id ||
              selectedEntityId === r.target_entity_id;
            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2;
            return (
              <g key={r.id}>
                {/* Invisible thick line for easier hover */}
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke="transparent"
                  strokeWidth={12}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={() => handleEdgeMouseEnter(r, mx, my)}
                  onMouseLeave={handleEdgeMouseLeave}
                />
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={
                    isHighlighted
                      ? "color-mix(in srgb, var(--accent) 70%, transparent)"
                      : "color-mix(in srgb, var(--border-focus) 40%, transparent)"
                  }
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={isHighlighted ? undefined : "4 3"}
                  style={{ transition: "stroke 200ms ease, stroke-width 200ms ease" }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Entity nodes */}
      {visibleEntities.map((entity) => {
        const pos = posMap[entity.id];
        if (!pos) return null;
        const color = TYPE_COLORS[entity.type];
        const isSelected = selectedEntityId === entity.id;
        const isConnected =
          !selectedEntityId ||
          isSelected ||
          relationships.some(
            (r) =>
              (r.source_entity_id === selectedEntityId && r.target_entity_id === entity.id) ||
              (r.target_entity_id === selectedEntityId && r.source_entity_id === entity.id)
          );

        return (
          <motion.div
            key={entity.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: isConnected ? 1 : 0.12,
              scale: isSelected ? 1.1 : 1,
              x: pos.x - 40,
              y: pos.y - 40,
            }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="absolute"
            style={{ width: 80, height: 80 }}
          >
            <button
              onClick={() => onSelectEntity(isSelected ? null : entity.id)}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-[0.95]",
                isSelected ? "shadow-lg" : "hover:scale-105"
              )}
              style={{
                borderColor: isSelected ? color : `color-mix(in srgb, ${color} 40%, transparent)`,
                background: `color-mix(in srgb, ${color} ${isSelected ? 18 : 8}%, var(--surface))`,
                boxShadow: isSelected
                  ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent), 0 8px 24px color-mix(in srgb, ${color} 20%, transparent)`
                  : undefined,
              }}
            >
              <p
                className="px-1 text-center font-heading text-xs leading-tight"
                style={{ color }}
              >
                {entity.name.length > 12 ? entity.name.slice(0, 11) + "…" : entity.name}
              </p>
              <p className="chapter-label mt-0.5 text-[9px]">{entity.type}</p>
            </button>
          </motion.div>
        );
      })}

      {/* Edge tooltip */}
      {edgeTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel pointer-events-none absolute z-20 rounded-[10px] px-3 py-1.5 text-xs text-[var(--text-main)]"
          style={{ left: edgeTooltip.x - 40, top: edgeTooltip.y - 36 }}
        >
          {edgeTooltip.label}
        </motion.div>
      )}

      {/* Empty relationships state */}
      {positions.length === 0 && size.w > 0 && (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-[var(--text-muted)]">Laying out the web…</p>
        </div>
      )}
    </div>
  );
}
