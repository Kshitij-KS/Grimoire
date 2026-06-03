import posthog from "posthog-js";

import type { WorldSection } from "@/lib/constants";
import type { PlanTier } from "@/lib/types";
import {
  ANALYTICS_EVENTS,
  type CoreAction,
} from "@/lib/analytics-events";

/**
 * Identifies the current user for analytics tracking.
 * Attaches the user's plan tier as a property.
 */
export function identifyUser(
  userId: string,
  properties: { plan: PlanTier }
): void {
  try {
    posthog.identify(userId, { plan: properties.plan });
  } catch {
    // Silent failure — analytics must never break the app
  }
}

/**
 * Tracks when a user navigates to a World_Workspace section.
 */
export function trackSectionViewed(
  section: WorldSection,
  worldId: string
): void {
  try {
    posthog.capture(ANALYTICS_EVENTS.SECTION_VIEWED, {
      section,
      world_id: worldId,
    });
  } catch {
    // Silent failure — analytics must never break the app
  }
}

/**
 * Tracks when a user completes a core action (lore inscribed, soul forged, etc.).
 */
export function trackCoreAction(action: CoreAction, worldId: string): void {
  try {
    posthog.capture(action, {
      world_id: worldId,
    });
  } catch {
    // Silent failure — analytics must never break the app
  }
}

/**
 * Tracks when a user hits a rate limit.
 */
export function trackRateLimitHit(
  action: string,
  limit: number,
  consumed: number
): void {
  try {
    posthog.capture(ANALYTICS_EVENTS.RATE_LIMIT_HIT, {
      action,
      limit,
      consumed,
    });
  } catch {
    // Silent failure — analytics must never break the app
  }
}

// Re-export types for consumer convenience
export type { CoreAction, WorldSection } from "@/lib/analytics-events";
