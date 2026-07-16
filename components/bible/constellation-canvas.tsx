"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import type { Entity, EntityType, EntityRelationship } from "@/lib/types";
import { ForgeRelationshipModal } from "./forge-relationship-modal";

// ── Theme-aware color resolution ──────────────────────────────────────────
// Canvas cannot read CSS variables directly; we resolve them from computed style.
function resolveThemeColors(): Record<EntityType, string> {
  if (typeof window === "undefined") {
    return {
      character: "#C4A86A",
      location: "#A594FF",
      faction: "#D25A5A",
      artifact: "#C3CBEC",
      event: "#7E6DF2",
      rule: "#7C86A8",
    };
  }
  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();
  return {
    character: get("--accent") || "#C4A86A",
    location:  get("--ai-pulse") || "#A594FF",
    faction:   get("--danger") || "#D25A5A",
    artifact:  get("--accent-soft") || "#C3CBEC",
    event:     get("--success") || "#7E6DF2",
    rule:      get("--text-muted") || "#7C86A8",
  };
}

// Fallback static colors (still rendered on first frame before theme resolves)
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
  visible: boolean;
  /** Importance in [0,1] derived from mention_count — drives size & glow. */
  weight: number;
  /** Deterministic per-node twinkle phase. */
  twinkle: number;
}

// Deterministic pseudo-random in [0,1) from an integer seed — used for the
// background starfield so it stays stable across frames (no flicker).
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
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

export function ConstellationCanvas({
  entities,
  relationships = [],
  onForgeRelationship,
  spotlightEntityId,
  canvasExportRef,
}: {
  entities: Entity[];
  relationships?: EntityRelationship[];
  onForgeRelationship?: (rel: EntityRelationship) => void;
  spotlightEntityId?: string | null;
  canvasExportRef?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  // Expose canvas to parent for screenshot via canvasExportRef
  const canvasRef = (canvasExportRef ?? internalCanvasRef) as React.RefObject<HTMLCanvasElement>;
  const containerRef = useRef<HTMLDivElement>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(
    new Set(["character", "location", "faction", "artifact", "event", "rule"] as EntityType[])
  );
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const searchQueryRef = useRef("");
  const activeTypesRef = useRef(activeTypes);
  const nodesRef = useRef<CanvasNode[]>([]);
  const hoveredNodeRef = useRef<CanvasNode | null>(null);
  const rafRef = useRef<number>(0);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetStartRef = useRef({ x: 0, y: 0 });
  const relationshipsRef = useRef(relationships);
  const isForgingLinkRef = useRef(false);
  const forgeSourceRef = useRef<CanvasNode | null>(null);
  const forgeCurrentPosRef = useRef<{ x: number; y: number } | null>(null);
  
  const [forgeModalOpen, setForgeModalOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);
  const [forgeSourceEntity, setForgeSourceEntity] = useState<Entity | null>(null);
  const [forgeTargetEntity, setForgeTargetEntity] = useState<Entity | null>(null);
  
  const { setSelectedEntity } = useWorkspaceStore();

  useEffect(() => {
    relationshipsRef.current = relationships;
  }, [relationships]);

  // Sync search/filter refs
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);
  useEffect(() => { activeTypesRef.current = activeTypes; }, [activeTypes]);

  // Spotlight: pan to entity when spotlightEntityId changes
  useEffect(() => {
    if (!spotlightEntityId) return;
    const node = nodesRef.current.find((n) => n.entity.id === spotlightEntityId);
    if (!node) return;
    const w = containerRef.current?.offsetWidth ?? 600;
    const h = containerRef.current?.offsetHeight ?? 400;
    offsetRef.current = {
      x: w / 2 - node.x * scaleRef.current,
      y: h / 2 - node.y * scaleRef.current,
    };
  }, [spotlightEntityId]);

  const buildNodes = useCallback(
    (width: number, height: number): CanvasNode[] => {
      const cx = width / 2;
      const cy = height / 2;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));

      // EVERY entity is a visible node (no hidden "members"). Sorted by type so
      // same-kind entities land on contiguous arcs of the spiral and read as
      // loose constellations.
      const ordered = [...entities].sort(
        (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
      );

      // Phyllotaxis (sunflower) placement: radius ∝ √index with the golden
      // angle between successive nodes — fills the plane evenly with a
      // guaranteed minimum gap between every pair, so nodes never crowd.
      const spacing = Math.max(66, Math.min(width, height) * 0.12);

      // Normalise mention_count across the set → importance in [0,1]. The
      // busiest entities read as brighter, larger "stars"; quiet ones stay
      // small, giving the map a natural visual hierarchy.
      const maxMentions = ordered.reduce(
        (m, e) => Math.max(m, e.mention_count ?? 0),
        1,
      );

      return ordered.map((entity, k) => {
        const radius = spacing * Math.sqrt(k + 0.5);
        const angle = k * goldenAngle;
        const hx = cx + Math.cos(angle) * radius;
        const hy = cy + Math.sin(angle) * radius;
        const anchored = entity.type === "faction" || entity.type === "location";
        // sqrt keeps a single dominant entity from dwarfing everything else.
        const weight = Math.sqrt((entity.mention_count ?? 0) / maxMentions);

        return {
          entity,
          homeX: hx,
          homeY: hy,
          targetX: hx,
          targetY: hy,
          x: hx,
          y: hy,
          driftPhase: k * goldenAngle,
          driftSpeed: 0.2 + (k % 5) * 0.04,
          driftAmplitude: anchored ? 1.4 : 2.4,
          opacity: 1,
          scale: 1,
          visible: true,
          weight,
          twinkle: seededRandom(k + 1) * Math.PI * 2,
        };
      });
    },
    [entities],
  );

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
      // NOTE: no ctx.scale(dpr) here — the draw loop sets an absolute transform
      // every frame (which would discard it). The dpr is applied there instead.
      nodesRef.current = buildNodes(w, h);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let t = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      // Clear the full device buffer under the identity transform.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.007;
      // Resolve theme-accurate colors each frame (cheap CSS var read)
      const themeColors = resolveThemeColors();
      // Theme-aware colours for relationship-label pills (adapts light/dark).
      const labelStyle = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
      const labelBg = labelStyle?.getPropertyValue("--surface-raised").trim() || "#1C1C1F";
      const labelFg = labelStyle?.getPropertyValue("--text-main").trim() || "#F4F4F5";

      const scale = scaleRef.current;
      const off = offsetRef.current;
      ctx.save();
      // World → device: apply the user zoom AND the device pixel ratio so what
      // is drawn lines up 1:1 with CSS-pixel hit-testing (toWorld/findNode).
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, off.x * dpr, off.y * dpr);

      const nodes = nodesRef.current;
      const hovered = hoveredNodeRef.current;

      // ── Background starfield ────────────────────────────────────────────
      // A faint, deterministic field of distant stars drawn in world space so
      // it pans/zooms with the map. Gives the void depth without competing
      // with the entity nodes. Drawn before everything else.
      {
        const starColor = themeColors.artifact ?? "#C3CBEC";
        const spanX = (canvas.width / dpr) / scale;
        const spanY = (canvas.height / dpr) / scale;
        const originX = -off.x / scale;
        const originY = -off.y / scale;
        const STAR_COUNT = 90;
        for (let i = 0; i < STAR_COUNT; i++) {
          const sx = originX + seededRandom(i * 2 + 1) * spanX;
          const sy = originY + seededRandom(i * 2 + 2) * spanY;
          const tw = 0.5 + 0.5 * Math.sin(t * 1.6 + i);
          const sr = 0.4 + seededRandom(i * 3 + 5) * 0.9;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fillStyle =
            starColor +
            Math.round((0.08 + tw * 0.14) * 0xff)
              .toString(16)
              .padStart(2, "0");
          ctx.fill();
        }
      }

      // Relationship focus: when a node is hovered, collect the ids it is linked
      // to via forged relationships. We use this both to keep those neighbours
      // lit (while dimming everyone else) and to draw only that node's labelled
      // edges — so the map reveals one entity's web at a time instead of
      // showing every link at once.
      const focusNode = hovered;
      const neighborIds = new Set<string>();
      if (focusNode) {
        for (const rel of relationshipsRef.current) {
          if (rel.source_entity_id === focusNode.entity.id) neighborIds.add(rel.target_entity_id);
          else if (rel.target_entity_id === focusNode.entity.id) neighborIds.add(rel.source_entity_id);
        }
      }

      for (const node of nodes) {
        const driftX = Math.cos(node.driftPhase + t * node.driftSpeed) * node.driftAmplitude;
        const driftY =
          Math.sin(node.driftPhase + t * node.driftSpeed * 0.7) * node.driftAmplitude * 0.6;
        node.x = node.homeX + driftX;
        node.y = node.homeY + driftY;

        const sq = searchQueryRef.current.toLowerCase();
        const atypes = activeTypesRef.current;
        const matchesSearch = !sq || node.entity.name.toLowerCase().includes(sq) || (node.entity.summary ?? "").toLowerCase().includes(sq);
        const matchesType = atypes.has(node.entity.type);

        let targetOpacity: number;
        if (!matchesType) {
          targetOpacity = 0.04;
        } else if (sq && !matchesSearch) {
          targetOpacity = 0.06;
        } else if (focusNode) {
          // The hovered node stays full; its related neighbours stay bright so
          // the relationship is legible; unrelated nodes recede.
          targetOpacity = node === focusNode ? 1 : neighborIds.has(node.entity.id) ? 0.95 : 0.12;
        } else {
          targetOpacity = 1;
        }
        node.opacity += (targetOpacity - node.opacity) * 0.1;
        node.scale += (1 - node.scale) * 0.1;
      }

      // NOTE: the old faint "same-type proximity web" was removed — those lines
      // implied relationships that don't exist and were the main source of
      // visual clutter. Only real, forged relationships are drawn (below).

      // Draw forged relationships as soft curved threads. When a node is
      // focused (hovered) we show ONLY its links, brightened and labelled;
      // otherwise every link is drawn quietly so the resting map stays calm and
      // never becomes a hairball.
      // In busy worlds the quiet all-links pass would still read as noise, so
      // above this many links we draw nothing at rest and rely on hover to
      // reveal each entity's web one at a time.
      const showRestingEdges = relationshipsRef.current.length <= 60;
      relationshipsRef.current.forEach((rel) => {
        const sourceNode = nodes.find((n) => n.entity.id === rel.source_entity_id);
        const targetNode = nodes.find((n) => n.entity.id === rel.target_entity_id);
        if (!sourceNode || !targetNode || !sourceNode.visible || !targetNode.visible) return;

        const focused =
          !!focusNode &&
          (rel.source_entity_id === focusNode.entity.id ||
            rel.target_entity_id === focusNode.entity.id);
        // While focusing one node, hide links that don't touch it. At rest,
        // hide all links once the map is dense.
        if (focusNode && !focused) return;
        if (!focusNode && !showRestingEdges) return;

        // Tension → hue: calm gold (0) shifting toward alarm red (high).
        const tension = Math.max(0, Math.min(1, (rel.tension_score ?? 0) / 10));
        const rr = Math.round(212 + (224 - 212) * tension);
        const gg = Math.round(168 - 120 * tension);
        const bb = Math.round(83 - 40 * tension);
        const edgeAlpha = focused ? 0.9 : 0.3;
        const edgeColor = `rgba(${rr}, ${gg}, ${bb}, ${edgeAlpha})`;

        // Gentle quadratic curve so parallel links between clusters separate
        // instead of overlapping as straight lines.
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const len = Math.hypot(dx, dy) || 1;
        const curve = Math.min(30, len * 0.14);
        const apexX = (sourceNode.x + targetNode.x) / 2 + (-dy / len) * curve;
        const apexY = (sourceNode.y + targetNode.y) / 2 + (dx / len) * curve;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.quadraticCurveTo(apexX, apexY, targetNode.x, targetNode.y);
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = focused ? 1.8 : 1;
        if (!focused) ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Relationship label — only for the focused node's links, sitting on the
        // curve apex with a theme-aware pill so text never smears over the map.
        if (focused && rel.label) {
          const text = rel.label.length > 24 ? rel.label.slice(0, 22) + "…" : rel.label;
          ctx.font = "600 9px Inter, sans-serif";
          ctx.textAlign = "center";
          const tw = ctx.measureText(text).width;
          const padX = 6;
          const pillH = 15;
          const pillW = tw + padX * 2;
          const pillX = apexX - pillW / 2;
          const pillY = apexY - pillH / 2;
          const radius = pillH / 2;

          ctx.save();
          ctx.globalAlpha = 0.92;
          ctx.beginPath();
          ctx.moveTo(pillX + radius, pillY);
          ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, radius);
          ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, radius);
          ctx.arcTo(pillX, pillY + pillH, pillX, pillY, radius);
          ctx.arcTo(pillX, pillY, pillX + pillW, pillY, radius);
          ctx.closePath();
          ctx.fillStyle = labelBg;
          ctx.fill();
          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = labelFg;
          ctx.fillText(text, apexX, apexY + 3);
        }
      });

      // Draw active forging link
      if (isForgingLinkRef.current && forgeSourceRef.current && forgeCurrentPosRef.current) {
        const sx = forgeSourceRef.current.x;
        const sy = forgeSourceRef.current.y;
        const ex = forgeCurrentPosRef.current.x;
        const ey = forgeCurrentPosRef.current.y;
        
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = "rgba(212, 168, 83, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add outer glow
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.shadowColor = "rgba(212, 168, 83, 0.6)";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }

      // ── Draw nodes ──────────────────────────────────────────────────────
      // Each entity is rendered as a layered "star": a soft outer glow, a
      // radial-gradient core, a crisp rim-light stroke, and a bright inner
      // highlight. Size scales with importance (weight) so busy entities read
      // as bright anchors and quiet ones as distant sparks.
      for (const node of nodes) {
        if (node.opacity < 0.01 && node.scale < 0.01) continue;

        const color = themeColors[node.entity.type] ?? TYPE_COLORS[node.entity.type] ?? "#E0E0E0";
        const isHov = node === hovered;
        const baseR = TYPE_RADIUS[node.entity.type] ?? 5;
        // Importance adds up to ~70% to the base radius; hover adds a fixed pop.
        const importanceR = baseR * (1 + node.weight * 0.7);
        const r = (isHov ? importanceR + 2.5 : importanceR) * node.scale;
        // Gentle per-node twinkle keeps the field alive without being busy.
        const twinkle = 0.85 + 0.15 * Math.sin(t * 1.4 + node.twinkle);
        const alpha = node.opacity * twinkle;
        const hex = (a: number) =>
          Math.round(Math.max(0, Math.min(1, a)) * 0xff)
            .toString(16)
            .padStart(2, "0");

        ctx.save();

        // Layered soft glow — larger & warmer for important/hovered nodes.
        const glowR = r * (isHov ? 5.4 : 3.8) * (1 + node.weight * 0.5);
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        grd.addColorStop(0, color + hex(alpha * (0.34 + node.weight * 0.25)));
        grd.addColorStop(0.5, color + hex(alpha * 0.12));
        grd.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core fill — radial gradient from a near-white centre to the type hue
        // gives each node a lit, three-dimensional feel.
        const coreGrad = ctx.createRadialGradient(
          node.x - r * 0.3,
          node.y - r * 0.3,
          r * 0.1,
          node.x,
          node.y,
          r,
        );
        coreGrad.addColorStop(0, "#FFFFFF" + hex(alpha * 0.95));
        coreGrad.addColorStop(0.45, color + hex(alpha));
        coreGrad.addColorStop(1, color + hex(alpha * 0.72));
        drawNodeShape(ctx, node.entity.type, node.x, node.y, r);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Rim light — crisp outline that separates the node from its glow.
        drawNodeShape(ctx, node.entity.type, node.x, node.y, r);
        ctx.strokeStyle = color + hex(alpha * 0.9);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner specular highlight for a glassy, gem-like read.
        ctx.beginPath();
        ctx.arc(node.x - r * 0.32, node.y - r * 0.32, Math.max(0.6, r * 0.22), 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF" + hex(alpha * 0.8);
        ctx.fill();

        // Rule inner ring (kept — reads as an inscribed sigil).
        if (node.entity.type === "rule") {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = color + hex(alpha * 0.6);
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Hover ring — a soft halo pulse around the focused node.
        if (isHov) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = color + hex(0.55);
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }

        ctx.restore();

        // Label — always show for hovered nodes, threshold 0.25 for others.
        // A dark legibility halo (shadow) keeps names readable over glow.
        if ((node.opacity > 0.25 || isHov) && node.scale > 0.3) {
          const raw = node.entity.name;
          const label = raw.length > 20 ? raw.slice(0, 18) + "…" : raw;
          const labelAlpha = isHov ? 1 : node.opacity * 0.78;
          const isBold = node.entity.type === "faction" || node.entity.type === "location";
          ctx.save();
          ctx.globalAlpha = labelAlpha;
          ctx.font = `${isBold ? "600 " : ""}${10 + node.weight * 2}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = 4;
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
  }, [entities, buildNodes, canvasRef]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offsetRef.current.x) / scaleRef.current,
      y: (clientY - rect.top - offsetRef.current.y) / scaleRef.current,
    };
  }, [canvasRef]);

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
      if (isForgingLinkRef.current && forgeSourceRef.current) {
        const { x, y } = toWorld(e.clientX, e.clientY);
        forgeCurrentPosRef.current = { x, y };
        
        const targetNode = findNode(x, y);
        hoveredNodeRef.current = targetNode;
        if (targetNode && targetNode !== forgeSourceRef.current) {
          if (canvasRef.current) canvasRef.current.style.cursor = "alias";
        } else {
          if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
        }
        return;
      }
      
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
      if (found) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const screenX = found.x * scaleRef.current + offsetRef.current.x;
          const screenY = found.y * scaleRef.current + offsetRef.current.y;
          setHoverTooltip({ x: screenX, y: screenY - 44, label: "Drag to forge a link" });
        }
      } else {
        setHoverTooltip(null);
      }
    },
    [toWorld, findNode, canvasRef],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toWorld(e.clientX, e.clientY);
    const node = findNode(x, y);
    
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    
    if (node) {
      isForgingLinkRef.current = true;
      forgeSourceRef.current = node;
      forgeCurrentPosRef.current = { x, y };
      if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
    } else {
      isDraggingRef.current = true;
      dragOffsetStartRef.current = { ...offsetRef.current };
      if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    }
  }, [toWorld, findNode, canvasRef]);

  const handleMouseUp = useCallback(() => {
    if (isForgingLinkRef.current && forgeSourceRef.current) {
      const source = forgeSourceRef.current;
      const target = hoveredNodeRef.current;
      
      if (target && target !== source) {
        setForgeSourceEntity(source.entity);
        setForgeTargetEntity(target.entity);
        setForgeModalOpen(true);
      }
      
      isForgingLinkRef.current = false;
      forgeSourceRef.current = null;
      forgeCurrentPosRef.current = null;
    }
    
    isDraggingRef.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }, [canvasRef]);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    isForgingLinkRef.current = false;
    forgeSourceRef.current = null;
    forgeCurrentPosRef.current = null;
    hoveredNodeRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }, [canvasRef]);

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
  }, [canvasRef]);

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
      if (!node) return;
      setSelectedEntity(node.entity);
    },
    [toWorld, findNode, setSelectedEntity],
  );

  if (entities.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="font-heading text-2xl italic text-[var(--text-muted)]">
          Write lore to populate the constellation.
        </p>
      </div>
    );
  }

  const ALL_ENTITY_TYPES: EntityType[] = ["character", "location", "faction", "artifact", "event", "rule"];
  const TYPE_SHAPE_LABELS: Record<EntityType, string> = {
    faction: "Faction ⬡",
    location: "Location ◆",
    character: "Character ●",
    artifact: "Artifact ■",
    event: "Event ▲",
    rule: "Rule ◎",
  };

  return (
    <>
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onClick={handleClick}
          className="block h-full w-full select-none"
        />

        {/* Search input overlay */}
        <div className="pointer-events-auto absolute left-4 top-4 z-10 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities…"
              className="glass-panel w-52 rounded-[16px] py-2 pl-9 pr-8 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
            />
            {searchQuery && (
              <button
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex flex-wrap gap-1">
            {ALL_ENTITY_TYPES.map((t) => {
              const active = activeTypes.has(t);
              const count = entities.filter((e) => e.type === t).length;
              if (count === 0) return null;
              return (
                <button
                  key={t}
                  onClick={() => {
                    setActiveTypes((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    });
                  }}
                  className="glass-panel rounded-full px-2.5 py-1 text-[10px] capitalize transition-colors"
                  style={{
                    opacity: active ? 1 : 0.4,
                    borderColor: active ? TYPE_COLORS[t] : undefined,
                    color: active ? TYPE_COLORS[t] : "var(--text-muted)",
                  }}
                >
                  {t} {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hover tooltip */}
        {hoverTooltip && !isForgingLinkRef.current && (
          <div
            className="pointer-events-none absolute z-20 whitespace-nowrap rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] shadow-md"
            style={{ left: hoverTooltip.x - 60, top: hoverTooltip.y }}
          >
            {hoverTooltip.label}
          </div>
        )}

        {/* Legend — collapsible on mobile */}
        <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-col rounded-[16px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-sm overflow-hidden">
          {isMobile ? (
            <>
              <button
                type="button"
                onClick={() => setLegendOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                title={legendOpen ? "Hide legend" : "Show legend"}
              >
                <span className="flex gap-1">
                  {ALL_ENTITY_TYPES.slice(0, 3).map((t) => (
                    <span key={t} className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                  ))}
                </span>
                <span className="font-medium">Legend</span>
                {legendOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </button>
              {legendOpen && (
                <div className="flex flex-col gap-1.5 border-t border-[var(--border)] px-3 pb-2.5 pt-2">
                  {ALL_ENTITY_TYPES.map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLORS[type] }} />
                      <span className="text-[10px] text-[var(--text-muted)]">{TYPE_SHAPE_LABELS[type]}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-1.5 px-3 py-2.5">
              {ALL_ENTITY_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLORS[type] }} />
                  <span className="text-[10px] text-[var(--text-muted)]">{TYPE_SHAPE_LABELS[type]}</span>
                </div>
              ))}
              <p className="mt-1 border-t border-[var(--border)] pt-1.5 text-[9px] text-[var(--text-muted)] opacity-60">
                Hover a node to reveal its links · Drag node to node to forge one · Scroll to zoom · Drag to pan
              </p>
            </div>
          )}
        </div>
      </div>
    <ForgeRelationshipModal
        open={forgeModalOpen}
        onOpenChange={setForgeModalOpen}
        worldId={entities[0]?.world_id || ""}
        sourceEntity={forgeSourceEntity}
        targetEntity={forgeTargetEntity}
        onSuccess={(newRel) => {
          if (onForgeRelationship) onForgeRelationship(newRel);
        }}
      />
    </>
  );
}
