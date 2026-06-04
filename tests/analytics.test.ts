import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock posthog-js before importing analytics
vi.mock("posthog-js", () => ({
  default: {
    identify: vi.fn(),
    capture: vi.fn(),
  },
}));

import posthog from "posthog-js";
import {
  identifyUser,
  trackSectionViewed,
  trackCoreAction,
  trackRateLimitHit,
} from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

describe("analytics module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("identifyUser", () => {
    it("calls posthog.identify with userId and plan property", () => {
      identifyUser("user-123", { plan: "free" });

      expect(posthog.identify).toHaveBeenCalledWith("user-123", {
        plan: "free",
      });
    });

    it("passes pro plan tier correctly", () => {
      identifyUser("user-456", { plan: "pro" });

      expect(posthog.identify).toHaveBeenCalledWith("user-456", {
        plan: "pro",
      });
    });

    it("does not throw when posthog.identify throws", () => {
      vi.mocked(posthog.identify).mockImplementationOnce(() => {
        throw new Error("PostHog unavailable");
      });

      expect(() => identifyUser("user-789", { plan: "free" })).not.toThrow();
    });
  });

  describe("trackSectionViewed", () => {
    it("calls posthog.capture with section_viewed event and correct properties", () => {
      trackSectionViewed("lore", "world-abc");

      expect(posthog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.SECTION_VIEWED,
        {
          section: "lore",
          world_id: "world-abc",
        }
      );
    });

    it("tracks different sections correctly", () => {
      trackSectionViewed("tavern", "world-xyz");

      expect(posthog.capture).toHaveBeenCalledWith("section_viewed", {
        section: "tavern",
        world_id: "world-xyz",
      });
    });

    it("does not throw when posthog.capture throws", () => {
      vi.mocked(posthog.capture).mockImplementationOnce(() => {
        throw new Error("Network error");
      });

      expect(() =>
        trackSectionViewed("souls", "world-123")
      ).not.toThrow();
    });
  });

  describe("trackCoreAction", () => {
    it("calls posthog.capture with the action as event name and world_id", () => {
      trackCoreAction("lore_inscribed", "world-001");

      expect(posthog.capture).toHaveBeenCalledWith("lore_inscribed", {
        world_id: "world-001",
      });
    });

    it("tracks soul_forged action correctly", () => {
      trackCoreAction("soul_forged", "world-002");

      expect(posthog.capture).toHaveBeenCalledWith("soul_forged", {
        world_id: "world-002",
      });
    });

    it("tracks consistency_check_run action correctly", () => {
      trackCoreAction("consistency_check_run", "world-003");

      expect(posthog.capture).toHaveBeenCalledWith("consistency_check_run", {
        world_id: "world-003",
      });
    });

    it("tracks tavern_session_created action correctly", () => {
      trackCoreAction("tavern_session_created", "world-004");

      expect(posthog.capture).toHaveBeenCalledWith("tavern_session_created", {
        world_id: "world-004",
      });
    });

    it("tracks narrator_tool_used action correctly", () => {
      trackCoreAction("narrator_tool_used", "world-005");

      expect(posthog.capture).toHaveBeenCalledWith("narrator_tool_used", {
        world_id: "world-005",
      });
    });

    it("does not throw when posthog.capture throws", () => {
      vi.mocked(posthog.capture).mockImplementationOnce(() => {
        throw new Error("Capture failed");
      });

      expect(() =>
        trackCoreAction("lore_inscribed", "world-err")
      ).not.toThrow();
    });
  });

  describe("trackRateLimitHit", () => {
    it("calls posthog.capture with rate_limit_hit event and correct properties", () => {
      trackRateLimitHit("lore_inscribed", 10, 10);

      expect(posthog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.RATE_LIMIT_HIT,
        {
          action: "lore_inscribed",
          limit: 10,
          consumed: 10,
        }
      );
    });

    it("passes numeric limit and consumed values correctly", () => {
      trackRateLimitHit("soul_forged", 5, 3);

      expect(posthog.capture).toHaveBeenCalledWith("rate_limit_hit", {
        action: "soul_forged",
        limit: 5,
        consumed: 3,
      });
    });

    it("does not throw when posthog.capture throws", () => {
      vi.mocked(posthog.capture).mockImplementationOnce(() => {
        throw new Error("Service down");
      });

      expect(() =>
        trackRateLimitHit("narrator_tool_used", 20, 20)
      ).not.toThrow();
    });
  });
});
