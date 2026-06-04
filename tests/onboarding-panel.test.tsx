// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Mock framer-motion to avoid animation complexity in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...filterDomProps(props)}>{children}</div>
    ),
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...filterDomProps(props)}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Helper to filter out non-DOM props from framer-motion
function filterDomProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  const ignore = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "layout",
    "layoutId",
    "variants",
  ]);
  for (const [key, value] of Object.entries(props)) {
    if (!ignore.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

import { OnboardingPanel } from "@/components/shared/onboarding-panel";

describe("OnboardingPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the panel when not dismissed and not finished", () => {
    render(
      <OnboardingPanel
        currentStep={0}
        completedSteps={[false, false, false, false]}
        isDismissed={false}
        isFinished={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole("complementary", { name: /onboarding guide/i })).toBeDefined();
  });

  it("does not render when onboarding is finished", () => {
    render(
      <OnboardingPanel
        currentStep={3}
        completedSteps={[true, true, true, true]}
        isDismissed={false}
        isFinished={true}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByRole("complementary", { name: /onboarding guide/i })).toBeNull();
  });

  it("does not render when onboarding is dismissed", () => {
    render(
      <OnboardingPanel
        currentStep={0}
        completedSteps={[false, false, false, false]}
        isDismissed={true}
        isFinished={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByRole("complementary", { name: /onboarding guide/i })).toBeNull();
  });

  it("displays all 4 step titles", () => {
    render(
      <OnboardingPanel
        currentStep={0}
        completedSteps={[false, false, false, false]}
        isDismissed={false}
        isFinished={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Inscribe Your First Lore")).toBeDefined();
    expect(screen.getByText("Discover Extracted Entities")).toBeDefined();
    expect(screen.getByText("Forge a Soul")).toBeDefined();
    expect(screen.getByText("Speak with Your Creation")).toBeDefined();
  });

  it("displays progress indicator with completed count", () => {
    render(
      <OnboardingPanel
        currentStep={2}
        completedSteps={[true, true, false, false]}
        isDismissed={false}
        isFinished={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("2 of 4")).toBeDefined();
  });

  it("displays 0 of 4 when no steps are completed", () => {
    render(
      <OnboardingPanel
        currentStep={0}
        completedSteps={[false, false, false, false]}
        isDismissed={false}
        isFinished={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("0 of 4")).toBeDefined();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <OnboardingPanel
        currentStep={0}
        completedSteps={[false, false, false, false]}
        isDismissed={false}
        isFinished={false}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByRole("button", {
      name: /dismiss onboarding guide/i,
    });
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows extracting entities message when isExtractingEntities is true and on step 2", () => {
    render(
      <OnboardingPanel
        currentStep={1}
        completedSteps={[true, false, false, false]}
        isDismissed={false}
        isFinished={false}
        isExtractingEntities={true}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Extracting entities...")).toBeDefined();
  });

  it("does not show extracting entities message when not on step 2", () => {
    render(
      <OnboardingPanel
        currentStep={0}
        completedSteps={[false, false, false, false]}
        isDismissed={false}
        isFinished={false}
        isExtractingEntities={true}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByText("Extracting entities...")).toBeNull();
  });

  it("displays Getting Started header text", () => {
    render(
      <OnboardingPanel
        currentStep={0}
        completedSteps={[false, false, false, false]}
        isDismissed={false}
        isFinished={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Getting Started")).toBeDefined();
  });
});
