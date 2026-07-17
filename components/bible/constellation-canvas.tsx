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

const TYPE_RADIUS: Record<EntityType, number> = {
  faction: 9,
  location: 8,
  character: 5,
  artifact: 7,
  event: 7,
  rule: 6,
};

// Containment tiers — smaller number = bigger container. This drives the
// drill-down tree: locations contain factions, factions contain characters.
// Loose types (artifact/event/rule) sit at the leaf tier and attach to
// whatever references them, otherwise they float as their own roots. The
// "biggest entity present" naturally becomes a root because nothing of a
// larger tier exists to adopt it.
const TYPE_TIER: Record<EntityType, number> = {
  location: 0,
  faction: 1,
  character: 2,
  artifact: 3,
  event: 3,
  rule: 3,
};

// ── Colour helpers ─────────────────────────────────────────────────────────
// The node styling mixes the type hue toward light/dark to get a soft, matte,
// gem-like read (classy, not glossy). These parse hex → rgb and blend.
type RGB = [number, number, number];

function parseHexColor(input: string): RGB {
  const fallback: RGB = [196, 168, 106];
  if (!input) return fallback;
  let h = input.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return fallback;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return fallback;
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function mixRgb(a: RGB, b: RGB, amt: number): RGB {
  const k = Math.max(0, Math.min(1, amt));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function rgba([r, g, b]: RGB, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// Infer a containment parent for an entity using name mentions in summaries.
// A parent must be of a strictly larger container tier; among matches we prefer
// the closest tier (a character with a faction *and* a location match nests
// under the faction) and, as a tiebreak, the more-established container.
function inferParentId(entity: Entity, all: Entity[]): string | null {
  const eTier = TYPE_TIER[entity.type];
  if (eTier === 0) return null;
  const eName = entity.name.toLowerCase();
  const eSummary = (entity.summary ?? "").toLowerCase();
  let bestId: string | null = null;
  let bestScore = 0;
  for (const c of all) {
    if (c.id === entity.id) continue;
    const cTier = TYPE_TIER[c.type];
    if (cTier >= eTier) continue;
    const cName = c.name.toLowerCase();
    let score = 0;
    if (cName.length >= 3 && eSummary.includes(cName)) score += 5;
    if (eName.length >= 3 && (c.summary ?? "").toLowerCase().includes(eName)) score += 3;
    if (score === 0) continue;
    // Prefer the closest ancestor tier, then the busier container.
    score += cTier * 2 + Math.min(1, (c.mention_count ?? 0) / 50);
    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }
  return bestId;
}

interface CanvasNode {
  entity: Entity;
  /** Phyllotaxis home position (roots only). */
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  driftPhase: number;
  driftSpeed: number;
  driftAmplitude: number;
  opacity: number;
  scale: number;
  /** Importance in [0,1] derived from mention_count — drives size & glow. */
  weight: number;
  /** Deterministic per-node twinkle phase. */
  twinkle: number;
  // ── Containment hierarchy ──
  parentId: string | null;
  depth: number;
  /** Base angle of this node on its parent's orbit ring. */
  orbitAngle: number;
  /** Distance from parent when the parent is expanded. */
  orbitRadius: number;
  /** True when this node contains children that can be revealed. */
  hasChildren: boolean;
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
  // Set of entity ids whose children are currently revealed (drill-down state).
  const expandedIdsRef = useRef<Set<string>>(new Set());
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
    const byId = new Map(nodesRef.current.map((n) => [n.entity.id, n]));
    const node = byId.get(spotlightEntityId);
    if (!node) return;
    // Reveal the containment path so a deep entity isn't left collapsed inside
    // its ancestors when it is spotlighted from elsewhere.
    let cur = node;
    while (cur.parentId) {
      const p = byId.get(cur.parentId);
      if (!p) break;
      expandedIdsRef.current.add(p.entity.id);
      cur = p;
    }
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

      // 1) Infer the containment forest from name mentions in summaries.
      const parentOf = new Map<string, string | null>();
      const childrenOf = new Map<string, string[]>();
      for (const e of entities) parentOf.set(e.id, inferParentId(e, entities));
      for (const e of entities) {
        const p = parentOf.get(e.id) ?? null;
        if (p) {
          const arr = childrenOf.get(p);
          if (arr) arr.push(e.id);
          else childrenOf.set(p, [e.id]);
        }
      }

      // Depth = length of the ancestor chain (roots are depth 0). The tier
      // ordering guarantees no cycles, so this walk always terminates.
      const depthCache = new Map<string, number>();
      const depthOf = (id: string): number => {
        const cached = depthCache.get(id);
        if (cached !== undefined) return cached;
        const p = parentOf.get(id) ?? null;
        const d = p ? depthOf(p) + 1 : 0;
        depthCache.set(id, d);
        return d;
      };

      // 2) Roots (the visible top tier) laid out with phyllotaxis so they never
      // crowd. Ordered by tier then importance so the biggest containers sit
      // toward the centre.
      const roots = entities
        .filter((e) => !(parentOf.get(e.id) ?? null))
        .sort(
          (a, b) =>
            TYPE_TIER[a.type] - TYPE_TIER[b.type] ||
            (b.mention_count ?? 0) - (a.mention_count ?? 0),
        );
      const spacing = Math.max(72, Math.min(width, height) * 0.13);
      const rootPos = new Map<string, { x: number; y: number }>();
      roots.forEach((e, k) => {
        const radius = spacing * Math.sqrt(k + 0.5);
        const angle = k * goldenAngle;
        rootPos.set(e.id, {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });

      // 3) Orbit placement for children of each parent — evenly distributed
      // around a ring sized to fit them without overlap.
      const byId = new Map(entities.map((e) => [e.id, e]));
      const orbit = new Map<string, { angle: number; radius: number }>();
      for (const [pid, kids] of childrenOf) {
        const parentR = TYPE_RADIUS[byId.get(pid)?.type ?? "character"] ?? 5;
        kids.forEach((cid, i) => {
          const childR = TYPE_RADIUS[byId.get(cid)?.type ?? "character"] ?? 5;
          const minArc = childR * 2 + 30;
          const needed = (kids.length * minArc) / (2 * Math.PI);
          const base = parentR + 46 + depthOf(pid) * 4;
          const angle = (i / kids.length) * Math.PI * 2 + depthOf(pid) * 0.6;
          orbit.set(cid, { angle, radius: Math.max(base, needed) });
        });
      }

      // Importance in [0,1] from mention_count → drives size & glow.
      const maxMentions = entities.reduce(
        (m, e) => Math.max(m, e.mention_count ?? 0),
        1,
      );

      return entities.map((entity, k) => {
        const parentId = parentOf.get(entity.id) ?? null;
        const depth = depthOf(entity.id);
        const rp = rootPos.get(entity.id);
        const oi = orbit.get(entity.id);
        const hx = rp?.x ?? cx;
        const hy = rp?.y ?? cy;
        const anchored = TYPE_TIER[entity.type] <= 1;
        const weight = Math.sqrt((entity.mention_count ?? 0) / maxMentions);

        return {
          entity,
          homeX: hx,
          homeY: hy,
          x: hx,
          y: hy,
          driftPhase: k * goldenAngle,
          driftSpeed: 0.2 + (k % 5) * 0.04,
          driftAmplitude: anchored ? 1.2 : 2.2,
          opacity: parentId ? 0 : 1,
          scale: parentId ? 0 : 1,
          weight,
          twinkle: seededRandom(k + 1) * Math.PI * 2,
          parentId,
          depth,
          orbitAngle: oi?.angle ?? 0,
          orbitRadius: oi?.radius ?? 0,
          hasChildren: childrenOf.has(entity.id),
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

      // ── Visibility from the drill-down tree ─────────────────────────────
      // A node is visible when it is a root OR every ancestor up the chain is
      // expanded. This is what makes only the biggest containers show at rest
      // and reveals children as the user clicks inward.
      const expanded = expandedIdsRef.current;
      const nodeById = new Map(nodes.map((n) => [n.entity.id, n]));
      const visibleSet = new Set<string>();
      const isVisible = (n: CanvasNode): boolean => {
        let cur: CanvasNode | undefined = n;
        while (cur && cur.parentId) {
          const p = nodeById.get(cur.parentId);
          if (!p) break; // dangling parent → treat this sub-root as visible
          if (!expanded.has(p.entity.id)) return false;
          cur = p;
        }
        return true;
      };
      for (const n of nodes) if (isVisible(n)) visibleSet.add(n.entity.id);

      // Relationship focus: when a node is hovered, collect the ids it is linked
      // to via forged relationships. We use this both to keep those neighbours
      // lit (while dimming everyone else) and to draw only that node's labelled
      // edges — so the map reveals one entity's web at a time.
      const focusNode = hovered && visibleSet.has(hovered.entity.id) ? hovered : null;
      const neighborIds = new Set<string>();
      if (focusNode) {
        for (const rel of relationshipsRef.current) {
          if (rel.source_entity_id === focusNode.entity.id) neighborIds.add(rel.target_entity_id);
          else if (rel.target_entity_id === focusNode.entity.id) neighborIds.add(rel.source_entity_id);
        }
      }

      const sq = searchQueryRef.current.toLowerCase();
      const atypes = activeTypesRef.current;

      for (const node of nodes) {
        const vis = visibleSet.has(node.entity.id);

        // Position: roots drift around their phyllotaxis home; visible children
        // orbit their parent; hidden children collapse into the parent so
        // expand/collapse reads as a smooth branch in/out.
        let tx: number;
        let ty: number;
        if (!node.parentId) {
          tx = node.homeX + Math.cos(node.driftPhase + t * node.driftSpeed) * node.driftAmplitude;
          ty = node.homeY + Math.sin(node.driftPhase + t * node.driftSpeed * 0.7) * node.driftAmplitude * 0.6;
        } else {
          const p = nodeById.get(node.parentId);
          if (p && vis) {
            const a = node.orbitAngle + t * 0.12 + Math.sin(t * 0.5 + node.twinkle) * 0.04;
            tx = p.x + Math.cos(a) * node.orbitRadius;
            ty = p.y + Math.sin(a) * node.orbitRadius;
          } else if (p) {
            tx = p.x;
            ty = p.y;
          } else {
            tx = node.homeX;
            ty = node.homeY;
          }
        }
        // Roots track their (already smooth) drift directly; children ease so
        // the branch-out animation is visible.
        const posLerp = node.parentId ? 0.14 : 1;
        node.x += (tx - node.x) * posLerp;
        node.y += (ty - node.y) * posLerp;

        const matchesSearch = !sq || node.entity.name.toLowerCase().includes(sq) || (node.entity.summary ?? "").toLowerCase().includes(sq);
        const matchesType = atypes.has(node.entity.type);

        let targetOpacity: number;
        if (!vis) {
          targetOpacity = 0;
        } else if (!matchesType) {
          targetOpacity = 0.05;
        } else if (sq && !matchesSearch) {
          targetOpacity = 0.06;
        } else if (focusNode) {
          targetOpacity = node === focusNode ? 1 : neighborIds.has(node.entity.id) ? 0.95 : 0.14;
        } else {
          targetOpacity = 1;
        }
        node.opacity += (targetOpacity - node.opacity) * 0.12;
        node.scale += ((vis ? 1 : 0) - node.scale) * 0.12;
      }

      // ── Containment edges ───────────────────────────────────────────────
      // Faint tapered branches from each expanded parent to its revealed
      // children — this is the visual "tree" the user drills through.
      for (const node of nodes) {
        if (!node.parentId || !visibleSet.has(node.entity.id)) continue;
        const p = nodeById.get(node.parentId);
        if (!p) continue;
        const rgb = parseHexColor(themeColors[node.entity.type] ?? TYPE_COLORS[node.entity.type]);
        const dx = node.x - p.x;
        const dy = node.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const curve = Math.min(24, len * 0.12);
        const apexX = (p.x + node.x) / 2 + (-dy / len) * curve;
        const apexY = (p.y + node.y) / 2 + (dx / len) * curve;
        const grad = ctx.createLinearGradient(p.x, p.y, node.x, node.y);
        grad.addColorStop(0, rgba(rgb, 0.04 * node.opacity));
        grad.addColorStop(1, rgba(rgb, 0.3 * node.opacity));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(apexX, apexY, node.x, node.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
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
        const sourceNode = nodeById.get(rel.source_entity_id);
        const targetNode = nodeById.get(rel.target_entity_id);
        if (!sourceNode || !targetNode) return;
        if (!visibleSet.has(sourceNode.entity.id) || !visibleSet.has(targetNode.entity.id)) return;

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
      // Each entity is a soft, matte "gem": a restrained ambient glow, a core
      // shaded from a lightly-lit hue down to a deeper edge (no glossy white
      // hotspot), and a fine rim for definition. Containers carry a subtle ring
      // — dashed when collapsed, solid when expanded — as a quiet affordance.
      for (const node of nodes) {
        if (node.opacity < 0.01 && node.scale < 0.01) continue;

        const hexColor = themeColors[node.entity.type] ?? TYPE_COLORS[node.entity.type] ?? "#E0E0E0";
        const rgb = parseHexColor(hexColor);
        const lightRgb = mixRgb(rgb, [255, 255, 255], 0.4);
        const darkRgb = mixRgb(rgb, [8, 6, 12], 0.35);
        const isHov = node === hovered;
        const baseR = TYPE_RADIUS[node.entity.type] ?? 5;
        // Importance and depth: containers read a touch larger, deep leaves
        // slightly smaller, so the hierarchy is legible at a glance.
        const depthScale = Math.max(0.72, 1 - node.depth * 0.12);
        const importanceR = baseR * (1 + node.weight * 0.6) * depthScale;
        const r = (isHov ? importanceR + 2 : importanceR) * node.scale;
        if (r < 0.4) continue;
        // Very gentle breathing keeps the field alive without a "blinky" feel.
        const breathe = 0.94 + 0.06 * Math.sin(t * 1.1 + node.twinkle);
        const alpha = node.opacity * breathe;

        ctx.save();

        // Ambient glow — soft and restrained (matte, not neon).
        const glowR = r * (isHov ? 4.2 : 3) * (1 + node.weight * 0.35);
        const grd = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, glowR);
        grd.addColorStop(0, rgba(rgb, alpha * (0.16 + node.weight * 0.12)));
        grd.addColorStop(0.55, rgba(rgb, alpha * 0.05));
        grd.addColorStop(1, rgba(rgb, 0));
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core — top-lit gradient from a softly lightened hue to a deeper edge.
        const coreGrad = ctx.createRadialGradient(
          node.x - r * 0.4,
          node.y - r * 0.45,
          r * 0.15,
          node.x,
          node.y,
          r * 1.05,
        );
        coreGrad.addColorStop(0, rgba(lightRgb, alpha));
        coreGrad.addColorStop(0.5, rgba(rgb, alpha));
        coreGrad.addColorStop(1, rgba(darkRgb, alpha));
        drawNodeShape(ctx, node.entity.type, node.x, node.y, r);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Fine rim for definition — a hairline lighter edge, kept subtle.
        drawNodeShape(ctx, node.entity.type, node.x, node.y, r);
        ctx.strokeStyle = rgba(lightRgb, alpha * 0.55);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Rule inner ring (reads as an inscribed sigil).
        if (node.entity.type === "rule") {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(lightRgb, alpha * 0.5);
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Container affordance ring — quietly signals "click to reveal more".
        if (node.hasChildren && node.scale > 0.4) {
          const isExp = expanded.has(node.entity.id);
          const ringR = r + 4.5 + node.weight * 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(rgb, alpha * (isExp ? 0.5 : 0.32));
          ctx.lineWidth = 1;
          ctx.setLineDash(isExp ? [] : [2, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Hover halo — a single soft ring, gently pulsing.
        if (isHov) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 7 + Math.sin(t * 2.4) * 1.2, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(lightRgb, alpha * 0.5);
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }

        ctx.restore();

        // Label — shown for hovered nodes and for sufficiently visible ones.
        // A dark halo (shadow) keeps names readable over glow and edges.
        if ((node.opacity > 0.3 || isHov) && node.scale > 0.4) {
          const raw = node.entity.name;
          const label = raw.length > 20 ? raw.slice(0, 18) + "…" : raw;
          const labelAlpha = isHov ? 1 : node.opacity * 0.8;
          const isBold = TYPE_TIER[node.entity.type] <= 1;
          ctx.save();
          ctx.globalAlpha = labelAlpha;
          ctx.font = `${isBold ? "600 " : ""}${Math.round(9.5 + node.weight * 2 - node.depth * 0.6)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 4;
          ctx.fillStyle = rgba(mixRgb(rgb, [255, 255, 255], 0.15), 1);
          ctx.fillText(label, node.x, node.y + r + 13);
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
    let best: CanvasNode | null = null;
    let bestDist = Infinity;
    for (const node of nodesRef.current) {
      // Only currently-revealed nodes are hittable (collapsed children shrink
      // to scale 0 inside their parent).
      if (node.scale < 0.25) continue;
      const baseR = TYPE_RADIUS[node.entity.type] ?? 5;
      const hitR = baseR * (1 + node.weight * 0.6) + 12;
      const d = Math.hypot(node.x - wx, node.y - wy);
      if (d < hitR && d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
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
          const isExp = expandedIdsRef.current.has(found.entity.id);
          const label = found.hasChildren
            ? isExp
              ? "Click to collapse · drag to forge"
              : "Click to reveal within · drag to forge"
            : "Drag to forge a link";
          setHoverTooltip({ x: screenX, y: screenY - 44, label });
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

      // Drill-down: clicking a container reveals its children; clicking an
      // expanded one collapses it (and any descendants, so re-opening starts
      // fresh). Selection happens either way so the detail panel stays in sync.
      if (node.hasChildren) {
        const ex = expandedIdsRef.current;
        if (ex.has(node.entity.id)) {
          const stack = [node.entity.id];
          while (stack.length) {
            const id = stack.pop() as string;
            ex.delete(id);
            for (const n of nodesRef.current) {
              if (n.parentId === id && ex.has(n.entity.id)) stack.push(n.entity.id);
            }
          }
        } else {
          ex.add(node.entity.id);
        }
      }

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

        {/* Legend — compact collapsible chip (collapsed by default to stay out
            of the way; expands into a tight two-column key). */}
        <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-sm data-[open=true]:rounded-[14px]"
          data-open={legendOpen}
        >
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
            title={legendOpen ? "Hide legend" : "Show legend"}
          >
            <span className="flex gap-0.5">
              {ALL_ENTITY_TYPES.slice(0, 3).map((t) => (
                <span key={t} className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLORS[t] }} />
              ))}
            </span>
            <span className="font-medium">Legend</span>
            {legendOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          {legendOpen && (
            <div className="border-t border-[var(--border)] px-2.5 pb-2 pt-1.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {ALL_ENTITY_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TYPE_COLORS[type] }} />
                    <span className="text-[10px] text-[var(--text-muted)]">{TYPE_SHAPE_LABELS[type]}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[9px] leading-snug text-[var(--text-muted)] opacity-60">
                Click a ringed node to reveal what&apos;s within · drag between nodes to forge a link
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
