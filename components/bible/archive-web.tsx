"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
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
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<{ x: number; y: number; label: string } | null>(null);

  // Only show entities with at least one relationship
  const connectedIds = new Set(
    relationships.flatMap((r) => [r.source_entity_id, r.target_entity_id])
  );
  const visibleEntities = entities.filter((e) => connectedIds.has(e.id));

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

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
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
