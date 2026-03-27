"use client";

import { useEffect, useRef, useCallback } from "react";
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

const TYPE_ORDER: EntityType[] = ["faction", "location", "character", "artifact", "event", "rule"];

const TYPE_RADIUS: Record<EntityType, number> = {
  faction: 9,
  location: 8,
  character: 5,
  artifact: 7,
  event: 7,
  rule: 6,
};

interface CanvasNode {
  entity: Entity;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  driftPhase: number;
  driftSpeed: number;
  driftAmplitude: number;
  opacity: number;
  scale: number;
  isMember: boolean;
  parentId: string | null;
  visible: boolean;
}

function inferMemberships(entities: Entity[]): Map<string, Set<string>> {
  const collectives = entities.filter((e) => e.type === "faction" || e.type === "location");
  const characters = entities.filter((e) => e.type === "character");
  const map = new Map<string, Set<string>>();
  for (const col of collectives) {
    const members = characters.filter(
      (ch) =>
        (ch.summary ?? "").toLowerCase().includes(col.name.toLowerCase()) ||
        (col.summary ?? "").toLowerCase().includes(ch.name.toLowerCase()),
    );
    if (members.length > 0) {
      map.set(col.id, new Set(members.map((m) => m.id)));
    }
  }
  return map;
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    if (i === 0) ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    else ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.866, y + r * 0.5);
  ctx.lineTo(x - r * 0.866, y + r * 0.5);
  ctx.closePath();
}

function drawSquare(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const s = r * 0.85;
  ctx.rect(x - s, y - s, s * 2, s * 2);
}

function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  type: EntityType,
  x: number,
  y: number,
  r: number,
) {
  switch (type) {
    case "faction":
      drawHexagon(ctx, x, y, r);
      break;
    case "location":
      drawDiamond(ctx, x, y, r);
      break;
    case "event":
      drawTriangle(ctx, x, y, r);
      break;
    case "artifact":
      ctx.beginPath();
      drawSquare(ctx, x, y, r);
      ctx.closePath();
      return;
    default:
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
  }
}

export function ConstellationCanvas({ entities }: { entities: Entity[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  const membershipsRef = useRef<Map<string, Set<string>>>(new Map());
  const hoveredNodeRef = useRef<CanvasNode | null>(null);
  const expandedIdRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetStartRef = useRef({ x: 0, y: 0 });
  const { setSelectedEntity } = useWorkspaceStore();

  const buildNodes = useCallback(
    (width: number, height: number): CanvasNode[] => {
      const cx = width / 2;
      const cy = height / 2;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const memberships = membershipsRef.current;

      const memberCharIds = new Set<string>();
      for (const ids of memberships.values()) ids.forEach((id) => memberCharIds.add(id));

      const groups: Record<EntityType, Entity[]> = {
        faction: [],
        location: [],
        character: [],
        artifact: [],
        event: [],
        rule: [],
      };
      for (const e of entities) {
        if (e.type === "character" && memberCharIds.has(e.id)) continue;
        if (groups[e.type]) groups[e.type].push(e);
      }

      const nodes: CanvasNode[] = [];
      const totalGroups = TYPE_ORDER.length;

      TYPE_ORDER.forEach((type, groupIdx) => {
        const groupEntities = groups[type];
        if (groupEntities.length === 0) return;

        const arcStart = (groupIdx / totalGroups) * Math.PI * 2 - Math.PI / 2;
        const arcEnd = ((groupIdx + 1) / totalGroups) * Math.PI * 2 - Math.PI / 2;

        groupEntities.forEach((entity, i) => {
          const ring = Math.floor(i / 4);
          const baseRadius = Math.min(width, height) * 0.22 + ring * 80;
          const t = (i % 4 + 0.5) / Math.min(groupEntities.length, 4);
          const angle = arcStart + t * (arcEnd - arcStart);
          const hx = cx + Math.cos(angle) * baseRadius;
          const hy = cy + Math.sin(angle) * baseRadius;

          nodes.push({
            entity,
            homeX: hx,
            homeY: hy,
            targetX: hx,
            targetY: hy,
            x: hx,
            y: hy,
            driftPhase: i * goldenAngle + groupIdx,
            driftSpeed: 0.28 + Math.random() * 0.35,
            driftAmplitude:
              type === "faction" || type === "location" ? 3 : 5 + Math.random() * 5,
            opacity: 1,
            scale: 1,
            isMember: false,
            parentId: null,
            visible: true,
          });
        });
      });

      // Place member characters collapsed at parent position
      for (const [parentId, charIds] of memberships.entries()) {
        const parentNode = nodes.find((n) => n.entity.id === parentId);
        if (!parentNode) continue;

        const charEntities = [...charIds]
          .map((id) => entities.find((e) => e.id === id))
          .filter(Boolean) as Entity[];

        charEntities.forEach((entity, i) => {
          const orbitR = 55 + Math.floor(i / 6) * 30;
          const angle = (i / Math.max(charEntities.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const tx = parentNode.homeX + Math.cos(angle) * orbitR;
          const ty = parentNode.homeY + Math.sin(angle) * orbitR;

          nodes.push({
            entity,
            homeX: parentNode.homeX,
            homeY: parentNode.homeY,
            targetX: tx,
            targetY: ty,
            x: parentNode.homeX,
            y: parentNode.homeY,
            driftPhase: i * goldenAngle,
            driftSpeed: 0.4 + Math.random() * 0.3,
            driftAmplitude: 3 + Math.random() * 3,
            opacity: 0,
            scale: 0,
            isMember: true,
            parentId,
            visible: false,
          });
        });
      }

      return nodes;
    },
    [entities],
  );

  useEffect(() => {
    membershipsRef.current = inferMemberships(entities);
  }, [entities]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      nodesRef.current = buildNodes(w, h);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let t = 0;

    const draw = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      t += 0.007;

      const scale = scaleRef.current;
      const off = offsetRef.current;
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, off.x, off.y);

      const nodes = nodesRef.current;
      const hovered = hoveredNodeRef.current;
      const expandedId = expandedIdRef.current;
      const memberships = membershipsRef.current;

      for (const node of nodes) {
        if (node.visible) {
          const driftX = Math.cos(node.driftPhase + t * node.driftSpeed) * node.driftAmplitude;
          const driftY =
            Math.sin(node.driftPhase + t * node.driftSpeed * 0.7) * node.driftAmplitude * 0.6;

          if (node.isMember) {
            node.x += (node.targetX + driftX - node.x) * 0.07;
            node.y += (node.targetY + driftY - node.y) * 0.07;
          } else {
            node.x = node.homeX + driftX;
            node.y = node.homeY + driftY;
          }
        } else {
          node.x += (node.homeX - node.x) * 0.1;
          node.y += (node.homeY - node.y) * 0.1;
        }

        let targetOpacity: number;
        if (!node.visible) {
          targetOpacity = 0;
        } else if (expandedId && !node.isMember && node.entity.id !== expandedId) {
          targetOpacity = 0.18;
        } else if (hovered && !node.isMember) {
          targetOpacity = node === hovered ? 1 : 0.22;
        } else {
          targetOpacity = 1;
        }
        node.opacity += (targetOpacity - node.opacity) * 0.1;
        const targetScale = node.visible ? 1 : 0;
        node.scale += (targetScale - node.scale) * 0.1;
      }

      // Edges between same-type top-level nodes
      for (let i = 0; i < nodes.length; i++) {
        if (!nodes[i].visible || nodes[i].opacity < 0.05 || nodes[i].isMember) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          if (!nodes[j].visible || nodes[j].opacity < 0.05 || nodes[j].isMember) continue;
          if (nodes[i].entity.type !== nodes[j].entity.type) continue;
          const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (dist > 210) continue;
          const a = 0.07 * Math.min(nodes[i].opacity, nodes[j].opacity);
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(215,221,242,${a})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Member edges
      if (expandedId) {
        const parentNode = nodes.find((n) => n.entity.id === expandedId);
        if (parentNode) {
          for (const mn of nodes) {
            if (mn.parentId !== expandedId || !mn.visible) continue;
            ctx.beginPath();
            ctx.moveTo(parentNode.x, parentNode.y);
            ctx.lineTo(mn.x, mn.y);
            ctx.strokeStyle = `rgba(196,168,106,${0.15 * mn.opacity})`;
            ctx.lineWidth = 0.8;
            ctx.setLineDash([3, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.opacity < 0.01 && node.scale < 0.01) continue;

        const color = TYPE_COLORS[node.entity.type] ?? "#E0E0E0";
        const isHov = node === hovered;
        const baseR = TYPE_RADIUS[node.entity.type] ?? 5;
        const r = (isHov ? baseR + 2.5 : baseR) * node.scale;

        ctx.save();
        ctx.globalAlpha = node.opacity;

        // Faction orbit ring
        if (
          node.entity.type === "faction" &&
          memberships.has(node.entity.id) &&
          node.scale > 0.1
        ) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 22 * node.scale, 0, Math.PI * 2);
          ctx.strokeStyle = color + "44";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          const memberCount = memberships.get(node.entity.id)?.size ?? 0;
          const isExpanded = expandedIdRef.current === node.entity.id;
          ctx.font = "bold 8px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = color + "CC";
          ctx.fillText(isExpanded ? "▾" : `+${memberCount}`, node.x, node.y - 28 * node.scale);
        }

        // Glow
        const glowR = r * 3.8;
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        grd.addColorStop(0, color + "44");
        grd.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Node shape + fill
        drawNodeShape(ctx, node.entity.type, node.x, node.y, r);
        ctx.fillStyle = color + Math.round(node.opacity * 0xff).toString(16).padStart(2, "0");
        ctx.fill();

        // Rule inner ring
        if (node.entity.type === "rule") {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = color + "99";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Hover ring
        if (isHov) {
          drawNodeShape(ctx, node.entity.type, node.x, node.y, r + 2);
          ctx.strokeStyle = color + "CC";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();

        // Label
        if (node.opacity > 0.25 && node.scale > 0.3) {
          const raw = node.entity.name;
          const label = raw.length > 16 ? raw.slice(0, 14) + "…" : raw;
          const labelAlpha = node.opacity * (isHov ? 1 : 0.78);
          ctx.save();
          ctx.globalAlpha = labelAlpha;
          const isBold = node.entity.type === "faction" || node.entity.type === "location";
          ctx.font = `${isBold ? "bold " : ""}${node.isMember ? 9 : 10}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = color;
          ctx.fillText(label, node.x, node.y + r + 14);
          ctx.restore();
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [entities, buildNodes]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offsetRef.current.x) / scaleRef.current,
      y: (clientY - rect.top - offsetRef.current.y) / scaleRef.current,
    };
  }, []);

  const findNode = useCallback((wx: number, wy: number) => {
    for (const node of nodesRef.current) {
      if (!node.visible && node.scale < 0.1) continue;
      const r = (TYPE_RADIUS[node.entity.type] ?? 5) + 10;
      if (Math.hypot(node.x - wx, node.y - wy) < r) return node;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDraggingRef.current) {
        offsetRef.current = {
          x: dragOffsetStartRef.current.x + (e.clientX - dragStartRef.current.x),
          y: dragOffsetStartRef.current.y + (e.clientY - dragStartRef.current.y),
        };
        return;
      }
      const { x, y } = toWorld(e.clientX, e.clientY);
      const found = findNode(x, y);
      hoveredNodeRef.current = found;
      if (canvasRef.current) canvasRef.current.style.cursor = found ? "pointer" : "default";
    },
    [toWorld, findNode],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetStartRef.current = { ...offsetRef.current };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    hoveredNodeRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.4, scaleRef.current * delta));
    offsetRef.current = {
      x: mx - (mx - offsetRef.current.x) * (newScale / scaleRef.current),
      y: my - (my - offsetRef.current.y) * (newScale / scaleRef.current),
    };
    scaleRef.current = newScale;
  }, []);

  const handleDoubleClick = useCallback(() => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const movedTooFar =
        Math.abs(e.clientX - dragStartRef.current.x) > 5 ||
        Math.abs(e.clientY - dragStartRef.current.y) > 5;
      if (movedTooFar) return;

      const { x, y } = toWorld(e.clientX, e.clientY);
      const node = findNode(x, y);

      if (!node) {
        if (expandedIdRef.current) {
          for (const n of nodesRef.current) {
            if (n.parentId === expandedIdRef.current) n.visible = false;
          }
          expandedIdRef.current = null;
        }
        return;
      }

      const memberships = membershipsRef.current;
      const isCollective =
        (node.entity.type === "faction" || node.entity.type === "location") &&
        memberships.has(node.entity.id);

      if (isCollective) {
        const isExpanded = expandedIdRef.current === node.entity.id;

        if (expandedIdRef.current) {
          for (const n of nodesRef.current) {
            if (n.parentId === expandedIdRef.current) n.visible = false;
          }
        }

        if (!isExpanded) {
          expandedIdRef.current = node.entity.id;
          for (const n of nodesRef.current) {
            if (n.parentId === node.entity.id) {
              n.visible = true;
              n.x = node.x;
              n.y = node.y;
              n.opacity = 0;
              n.scale = 0;
            }
          }
        } else {
          expandedIdRef.current = null;
        }
      }

      setSelectedEntity(node.entity);
    },
    [toWorld, findNode, setSelectedEntity],
  );

  if (entities.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="font-heading text-2xl italic text-secondary">
          Write lore to populate the constellation.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
        className="block h-full w-full select-none"
      />
      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col gap-1.5 rounded-[16px] bg-[rgba(13,11,8,0.72)] px-3 py-2.5 backdrop-blur-sm">
        {(
          [
            ["faction", "Faction ⬡ — click to expand"],
            ["location", "Location ◆"],
            ["character", "Character ●"],
            ["artifact", "Artifact ■"],
            ["event", "Event ▲"],
            ["rule", "Rule ◎"],
          ] as [EntityType, string][]
        ).map(([type, label]) => (
          <div key={type} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: TYPE_COLORS[type] }}
            />
            <span className="text-[10px] text-secondary">{label}</span>
          </div>
        ))}
        <p className="mt-1 border-t border-[rgba(255,255,255,0.06)] pt-1.5 text-[9px] text-secondary opacity-60">
          Scroll to zoom · Drag to pan · Double-click to reset
        </p>
      </div>
    </div>
  );
}
