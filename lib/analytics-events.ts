import type { WorldSection } from "@/lib/constants";
import type { PlanTier } from "@/lib/types";

// ── Event Name Constants ─────────────────────────────────────────────────

export const ANALYTICS_EVENTS = {
  SECTION_VIEWED: "section_viewed",
  LORE_INSCRIBED: "lore_inscribed",
  SOUL_FORGED: "soul_forged",
  CONSISTENCY_CHECK_RUN: "consistency_check_run",
  TAVERN_SESSION_CREATED: "tavern_session_created",
  NARRATOR_TOOL_USED: "narrator_tool_used",
  RATE_LIMIT_HIT: "rate_limit_hit",
} as const;

// ── Core Action Type ─────────────────────────────────────────────────────

export type CoreAction =
  | "lore_inscribed"
  | "soul_forged"
  | "consistency_check_run"
  | "tavern_session_created"
  | "narrator_tool_used";

// ── Payload Type Definitions ─────────────────────────────────────────────

export interface IdentifyUserProperties {
  plan: PlanTier;
}

export interface SectionViewedPayload {
  section: WorldSection;
  world_id: string;
}

export interface CoreActionPayload {
  action: CoreAction;
  world_id: string;
}

export interface RateLimitHitPayload {
  action: string;
  limit: number;
  consumed: number;
}

// Re-export WorldSection for convenience
export type { WorldSection } from "@/lib/constants";
