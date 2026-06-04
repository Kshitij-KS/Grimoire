// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  ONBOARDING_STEPS,
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "@/lib/onboarding-steps";

// ── Mock Supabase browser client ──
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return {};
    },
  }),
}));

// Set up chain mocks
function setupSupabaseMocks(initialState: OnboardingState | null = null) {
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSingle.mockResolvedValue({
    data: initialState ? { onboarding_state: initialState } : null,
    error: null,
  });
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
}

// Import useOnboarding after mocks are set up
import { useOnboarding } from "@/lib/hooks/use-onboarding";

describe("onboarding-steps", () => {
  describe("ONBOARDING_STEPS", () => {
    it("defines exactly 4 steps", () => {
      expect(ONBOARDING_STEPS).toHaveLength(4);
    });

    it("has write-lore as the first step targeting lore section", () => {
      expect(ONBOARDING_STEPS[0]).toEqual({
        id: "write-lore",
        title: "Inscribe Your First Lore",
        section: "lore",
      });
    });

    it("has view-entity as the second step targeting bible section", () => {
      expect(ONBOARDING_STEPS[1]).toEqual({
        id: "view-entity",
        title: "Discover Extracted Entities",
        section: "bible",
      });
    });

    it("has forge-soul as the third step targeting souls section", () => {
      expect(ONBOARDING_STEPS[2]).toEqual({
        id: "forge-soul",
        title: "Forge a Soul",
        section: "souls",
      });
    });

    it("has chat-soul as the fourth step targeting souls section", () => {
      expect(ONBOARDING_STEPS[3]).toEqual({
        id: "chat-soul",
        title: "Speak with Your Creation",
        section: "souls",
      });
    });

    it("steps are ordered sequentially: write-lore → view-entity → forge-soul → chat-soul", () => {
      const ids = ONBOARDING_STEPS.map((s) => s.id);
      expect(ids).toEqual(["write-lore", "view-entity", "forge-soul", "chat-soul"]);
    });
  });

  describe("DEFAULT_ONBOARDING_STATE", () => {
    it("starts at step 0", () => {
      expect(DEFAULT_ONBOARDING_STATE.currentStep).toBe(0);
    });

    it("has all steps incomplete", () => {
      expect(DEFAULT_ONBOARDING_STATE.completedSteps).toEqual([
        false,
        false,
        false,
        false,
      ]);
    });

    it("is not dismissed", () => {
      expect(DEFAULT_ONBOARDING_STATE.dismissed).toBe(false);
    });

    it("is not finished", () => {
      expect(DEFAULT_ONBOARDING_STATE.finished).toBe(false);
    });
  });
});

describe("useOnboarding hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupSupabaseMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("initializes with default state when no persisted state", async () => {
    setupSupabaseMocks(null);

    const { result } = renderHook(() =>
      useOnboarding({ userId: "user-1", worldId: "world-1" })
    );

    // Wait for state to load
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.currentStep).toBe(0);
    expect(result.current.completedSteps).toEqual([false, false, false, false]);
    expect(result.current.isFinished).toBe(false);
    expect(result.current.isDismissed).toBe(false);
  });

  it("loads persisted state from profiles table", async () => {
    const persistedState: OnboardingState = {
      currentStep: 2,
      completedSteps: [true, true, false, false],
      dismissed: false,
      finished: false,
    };
    setupSupabaseMocks(persistedState);

    const { result } = renderHook(() =>
      useOnboarding({ userId: "user-1", worldId: "world-1" })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.completedSteps).toEqual([true, true, false, false]);
  });

  describe("step completion", () => {
    it("completes a step and advances to next step", async () => {
      setupSupabaseMocks(null);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.completeStep(0);
      });

      expect(result.current.completedSteps[0]).toBe(true);
      expect(result.current.currentStep).toBe(1);
    });

    it("does not allow completing the same step twice", async () => {
      const persistedState: OnboardingState = {
        currentStep: 1,
        completedSteps: [true, false, false, false],
        dismissed: false,
        finished: false,
      };
      setupSupabaseMocks(persistedState);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.completeStep(0); // Already completed
      });

      // Should remain unchanged
      expect(result.current.currentStep).toBe(1);
      expect(result.current.completedSteps).toEqual([true, false, false, false]);
    });

    it("ignores invalid step indices (negative)", async () => {
      setupSupabaseMocks(null);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.completeStep(-1);
      });

      expect(result.current.completedSteps).toEqual([false, false, false, false]);
    });

    it("ignores invalid step indices (> 3)", async () => {
      setupSupabaseMocks(null);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.completeStep(4);
      });

      expect(result.current.completedSteps).toEqual([false, false, false, false]);
    });

    it("marks onboarding as finished when all 4 steps are completed", async () => {
      const persistedState: OnboardingState = {
        currentStep: 3,
        completedSteps: [true, true, true, false],
        dismissed: false,
        finished: false,
      };
      setupSupabaseMocks(persistedState);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.completeStep(3);
      });

      expect(result.current.isFinished).toBe(true);
      expect(result.current.completedSteps).toEqual([true, true, true, true]);
    });

    it("does not allow step completion after onboarding is finished", async () => {
      const persistedState: OnboardingState = {
        currentStep: 3,
        completedSteps: [true, true, true, true],
        dismissed: false,
        finished: true,
      };
      setupSupabaseMocks(persistedState);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Attempt to complete a step even though finished
      act(() => {
        result.current.completeStep(0);
      });

      // Should remain unchanged
      expect(result.current.isFinished).toBe(true);
    });

    it("advances currentStep to next incomplete step when steps are completed out of order", async () => {
      setupSupabaseMocks(null);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Complete step 2 (index 2) before step 0 and 1
      act(() => {
        result.current.completeStep(2);
      });

      // currentStep should advance to the first incomplete step (0)
      expect(result.current.currentStep).toBe(0);
      expect(result.current.completedSteps[2]).toBe(true);
    });
  });

  describe("dismiss and resume", () => {
    it("dismisses onboarding and records state", async () => {
      setupSupabaseMocks(null);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.isDismissed).toBe(true);
    });

    it("resume resets dismissed to false and sets currentStep to first incomplete", async () => {
      const persistedState: OnboardingState = {
        currentStep: 1,
        completedSteps: [true, false, false, false],
        dismissed: true,
        finished: false,
      };
      setupSupabaseMocks(persistedState);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Auto-resume kicks in on load per requirement 9.6,
      // so isDismissed should be false after loading a dismissed state
      expect(result.current.isDismissed).toBe(false);
      expect(result.current.currentStep).toBe(1);
    });

    it("dismiss does nothing when onboarding is already finished", async () => {
      const persistedState: OnboardingState = {
        currentStep: 3,
        completedSteps: [true, true, true, true],
        dismissed: false,
        finished: true,
      };
      setupSupabaseMocks(persistedState);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.dismiss();
      });

      // Should not change dismissed to true since it's already finished
      expect(result.current.isDismissed).toBe(false);
      expect(result.current.isFinished).toBe(true);
    });
  });

  describe("persistence", () => {
    it("calls supabase update on state change", async () => {
      setupSupabaseMocks(null);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.completeStep(0);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it("does not persist state when userId is null", async () => {
      setupSupabaseMocks(null);

      renderHook(() =>
        useOnboarding({ userId: null, worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // No persist calls should happen without userId
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("step 2 entity polling", () => {
    it("polls for entities when on step 2", async () => {
      const persistedState: OnboardingState = {
        currentStep: 1,
        completedSteps: [true, false, false, false],
        dismissed: false,
        finished: false,
      };
      setupSupabaseMocks(persistedState);

      // Mock fetch to return entities
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => [{ id: "entity-1" }],
      } as Response);

      const { result } = renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Step 2 should be completed after entities are found
      expect(result.current.completedSteps[1]).toBe(true);
    });

    it("does not poll when not on step 2", async () => {
      setupSupabaseMocks(null); // Default state at step 0

      renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // fetch should not be called for entity polling at step 0
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/entities")
      );
    });

    it("does not poll when step 2 is already completed", async () => {
      const persistedState: OnboardingState = {
        currentStep: 2,
        completedSteps: [true, true, false, false],
        dismissed: false,
        finished: false,
      };
      setupSupabaseMocks(persistedState);

      renderHook(() =>
        useOnboarding({ userId: "user-1", worldId: "world-1" })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/entities")
      );
    });
  });
});
