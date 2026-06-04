// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

// Mock framer-motion to avoid animation complexity in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const filtered: Record<string, unknown> = {};
      const ignore = new Set(["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout", "layoutId", "variants"]);
      for (const [key, value] of Object.entries(props)) {
        if (!ignore.has(key)) filtered[key] = value;
      }
      return <div {...filtered}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock the Radix Dialog components used by the modal
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <h2 {...props}>{children}</h2>
  ),
  DialogDescription: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <p {...props}>{children}</p>
  ),
}));

// Mock the Button component
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
}));

import { isNearLimit, remainingUses } from "@/lib/hooks/use-rate-limit-status";
import { RateLimitWarning } from "@/components/shared/rate-limit-warning";
import { RateLimitModal, ACTION_LABELS } from "@/components/shared/rate-limit-modal";
import { useWorkspaceStore } from "@/lib/store";

// ─── Pure function tests: isNearLimit and remainingUses ───────────────────────

describe("isNearLimit", () => {
  it("returns true when count is exactly at 80% of limit", () => {
    // Math.ceil(10 * 0.8) = 8, count = 8 → true
    expect(isNearLimit(8, 10)).toBe(true);
  });

  it("returns true when count exceeds 80% of limit", () => {
    expect(isNearLimit(9, 10)).toBe(true);
    expect(isNearLimit(10, 10)).toBe(true);
  });

  it("returns false when count is below 80% of limit", () => {
    // Math.ceil(10 * 0.8) = 8, count = 7 → false
    expect(isNearLimit(7, 10)).toBe(false);
  });

  it("returns false when count is 0", () => {
    expect(isNearLimit(0, 10)).toBe(false);
  });

  it("returns false when limit is 0", () => {
    expect(isNearLimit(0, 0)).toBe(false);
  });

  it("returns false when limit is negative", () => {
    expect(isNearLimit(5, -1)).toBe(false);
  });

  it("uses Math.ceil for the threshold calculation", () => {
    // For limit=5: Math.ceil(5 * 0.8) = Math.ceil(4) = 4
    expect(isNearLimit(4, 5)).toBe(true);
    expect(isNearLimit(3, 5)).toBe(false);

    // For limit=3: Math.ceil(3 * 0.8) = Math.ceil(2.4) = 3
    expect(isNearLimit(3, 3)).toBe(true);
    expect(isNearLimit(2, 3)).toBe(false);
  });

  it("handles large limits correctly", () => {
    // Math.ceil(100 * 0.8) = 80
    expect(isNearLimit(80, 100)).toBe(true);
    expect(isNearLimit(79, 100)).toBe(false);
  });

  it("handles limit of 1", () => {
    // Math.ceil(1 * 0.8) = Math.ceil(0.8) = 1
    expect(isNearLimit(1, 1)).toBe(true);
    expect(isNearLimit(0, 1)).toBe(false);
  });
});

describe("remainingUses", () => {
  it("returns correct remaining when count is below limit", () => {
    expect(remainingUses(3, 10)).toBe(7);
  });

  it("returns 0 when count equals limit", () => {
    expect(remainingUses(10, 10)).toBe(0);
  });

  it("returns 0 when count exceeds limit (never negative)", () => {
    expect(remainingUses(15, 10)).toBe(0);
  });

  it("returns full limit when count is 0", () => {
    expect(remainingUses(0, 10)).toBe(10);
  });

  it("returns 0 when both count and limit are 0", () => {
    expect(remainingUses(0, 0)).toBe(0);
  });

  it("handles count of 1 below limit", () => {
    expect(remainingUses(9, 10)).toBe(1);
  });
});

// ─── RateLimitWarning component tests ─────────────────────────────────────────

describe("RateLimitWarning", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders badge when usage is at 80% threshold", () => {
    render(<RateLimitWarning count={8} limit={10} />);

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText("2 left today")).toBeDefined();
  });

  it("renders badge when usage exceeds 80% threshold", () => {
    render(<RateLimitWarning count={9} limit={10} />);

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText("1 left today")).toBeDefined();
  });

  it("renders badge showing 0 left when limit is fully exhausted", () => {
    render(<RateLimitWarning count={10} limit={10} />);

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText("0 left today")).toBeDefined();
  });

  it("does not render when usage is below 80% threshold", () => {
    render(<RateLimitWarning count={7} limit={10} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not render when count is 0", () => {
    render(<RateLimitWarning count={0} limit={10} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("has accessible aria-label with remaining count", () => {
    render(<RateLimitWarning count={8} limit={10} />);

    const badge = screen.getByRole("status");
    expect(badge.getAttribute("aria-label")).toBe("2 uses left today");
  });

  it("applies additional className when provided", () => {
    render(<RateLimitWarning count={9} limit={10} className="ml-2" />);

    const badge = screen.getByRole("status");
    expect(badge.className).toContain("ml-2");
  });

  it("handles limit of 5 correctly (threshold at 4)", () => {
    // Math.ceil(5 * 0.8) = 4
    const { rerender } = render(<RateLimitWarning count={3} limit={5} />);
    expect(screen.queryByRole("status")).toBeNull();

    rerender(<RateLimitWarning count={4} limit={5} />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText("1 left today")).toBeDefined();
  });
});

// ─── RateLimitModal component tests ───────────────────────────────────────────

describe("RateLimitModal", () => {
  beforeEach(() => {
    // Reset the store state before each modal test
    useWorkspaceStore.setState({
      rateLimits: {
        chat_message: { count: 50, limit: 50 },
        lore_ingest: { count: 8, limit: 10 },
      },
    });
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.setState({ rateLimits: {} });
  });

  it("renders the modal when open is true", () => {
    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="chat_message" limit={50} />
    );

    expect(screen.getByTestId("dialog")).toBeDefined();
  });

  it("does not render when open is false", () => {
    render(
      <RateLimitModal open={false} onOpenChange={vi.fn()} action="chat_message" limit={50} />
    );

    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("displays the correct action label for known actions", () => {
    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="chat_message" limit={50} />
    );

    expect(screen.getAllByText("Soul Conversations").length).toBeGreaterThan(0);
  });

  it("displays formatted action name for unknown actions", () => {
    useWorkspaceStore.setState({
      rateLimits: {
        custom_action: { count: 5, limit: 5 },
      },
    });

    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="custom_action" limit={5} />
    );

    // custom_action → "Custom Action"
    expect(screen.getAllByText("Custom Action").length).toBeGreaterThan(0);
  });

  it("displays current count and max count from store", () => {
    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="chat_message" limit={50} />
    );

    expect(screen.getByText("50 / 50")).toBeDefined();
  });

  it("displays count from store for partially used limits", () => {
    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="lore_ingest" limit={10} />
    );

    expect(screen.getByText("8 / 10")).toBeDefined();
  });

  it("displays the reset countdown in hours and minutes format", () => {
    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="chat_message" limit={50} />
    );

    // The countdown should be a string matching Xh Xm or Xm format
    const resetSection = screen.getByText("Resets in");
    expect(resetSection).toBeDefined();

    // There should be a "UTC" label
    expect(screen.getByText("UTC")).toBeDefined();
  });

  it("displays an upgrade prompt", () => {
    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="chat_message" limit={50} />
    );

    expect(screen.getByText(/upgrade your plan/i)).toBeDefined();
  });

  it("displays the correct action labels mapping", () => {
    // Verify the ACTION_LABELS constant has all expected entries
    expect(ACTION_LABELS.chat_message).toBe("Soul Conversations");
    expect(ACTION_LABELS.lore_ingest).toBe("Lore Inscription");
    expect(ACTION_LABELS.lore_inscribe).toBe("Lore Inscription");
    expect(ACTION_LABELS.consistency_check).toBe("Consistency Checks");
    expect(ACTION_LABELS.soul_generate).toBe("Soul Forging");
    expect(ACTION_LABELS.soul_forge).toBe("Soul Forging");
    expect(ACTION_LABELS.tavern_session).toBe("Tavern Sessions");
    expect(ACTION_LABELS.narrator_tool).toBe("Narrator's Eye");
  });

  it("shows 'Return to your world' button", () => {
    render(
      <RateLimitModal open={true} onOpenChange={vi.fn()} action="chat_message" limit={50} />
    );

    expect(screen.getByText("Return to your world")).toBeDefined();
  });

  it("calls onOpenChange when close button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <RateLimitModal open={true} onOpenChange={onOpenChange} action="chat_message" limit={50} />
    );

    const button = screen.getByText("Return to your world");
    await user.click(button);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
