// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

// Mock framer-motion to avoid JSDOM issues
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { EmptyState } from "@/components/shared/empty-state";

describe("EmptyState component", () => {
  afterEach(() => {
    cleanup();
  });

  describe("variant default content renders per section condition", () => {
    it("renders lore variant with correct heading and description", () => {
      render(<EmptyState variant="lore" />);

      expect(screen.getByText("The page awaits.")).toBeDefined();
      expect(
        screen.getByText(
          "No lore written yet. Begin your world's first scroll — every word becomes living memory."
        )
      ).toBeDefined();
    });

    it("renders archive variant with correct heading and description", () => {
      render(<EmptyState variant="archive" />);

      expect(screen.getByText("The archive is silent.")).toBeDefined();
      expect(
        screen.getByText(
          "No entities have emerged yet. Write characters, places, and factions into the lore and they will appear here."
        )
      ).toBeDefined();
    });

    it("renders souls variant with default heading and description", () => {
      render(<EmptyState variant="souls" />);

      expect(screen.getByText("No souls are bound.")).toBeDefined();
      expect(
        screen.getByText(
          "Write characters into the lore, then forge them into bound souls who can speak in their own voice."
        )
      ).toBeDefined();
    });

    it("renders tavern variant with correct heading and description", () => {
      render(<EmptyState variant="tavern" />);

      expect(screen.getByText("The Tavern sits empty.")).toBeDefined();
      expect(
        screen.getByText(
          "Forge at least two souls to gather them here and watch them speak."
        )
      ).toBeDefined();
    });

    it("renders narrator variant with custom heading override", () => {
      render(
        <EmptyState
          icon={<span data-testid="eye-icon">Eye</span>}
          heading="The Narrator waits."
          description="Consistency checking and what-if analysis require lore to reason over. Inscribe your world's story first, then the Narrator will have something to examine."
        />
      );

      expect(screen.getByText("The Narrator waits.")).toBeDefined();
      expect(
        screen.getByText(/Consistency checking and what-if analysis/)
      ).toBeDefined();
      expect(screen.getByTestId("eye-icon")).toBeDefined();
    });

    it("explicit props override variant defaults", () => {
      render(
        <EmptyState
          variant="souls"
          heading="Custom Heading"
          description="Custom description text."
        />
      );

      expect(screen.getByText("Custom Heading")).toBeDefined();
      expect(screen.getByText("Custom description text.")).toBeDefined();
    });

    it("renders CTA button only when ctaLabel is provided", () => {
      const { rerender } = render(<EmptyState variant="lore" />);

      // No button without ctaLabel
      expect(screen.queryByRole("button")).toBeNull();

      // Button appears with ctaLabel
      rerender(<EmptyState variant="lore" ctaLabel="Begin Writing" />);
      expect(
        screen.getByRole("button", { name: "Begin Writing" })
      ).toBeDefined();
    });
  });

  describe("conditional Bound Souls messaging", () => {
    it("shows entities-present message when entities exist but no souls", () => {
      // This mirrors the world-workspace usage when entities.length > 0
      render(
        <EmptyState
          variant="souls"
          heading="No souls are bound."
          description="Your archive holds entities waiting to be given voice. Forge them into bound souls who can speak, remember, and reveal."
          ctaLabel="Go to The Archive"
          ctaAction={() => {}}
        />
      );

      expect(screen.getByText("No souls are bound.")).toBeDefined();
      expect(
        screen.getByText(
          "Your archive holds entities waiting to be given voice. Forge them into bound souls who can speak, remember, and reveal."
        )
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Go to The Archive" })
      ).toBeDefined();
    });

    it("shows no-entities message when both entities and souls are absent", () => {
      // This mirrors the world-workspace usage when entities.length === 0
      render(
        <EmptyState
          variant="souls"
          heading="No souls are bound."
          description="Souls require lore-derived entities. Write characters into the lore first, then return here to forge them into living voices."
          ctaLabel="Go to Lore Scribe"
          ctaAction={() => {}}
        />
      );

      expect(screen.getByText("No souls are bound.")).toBeDefined();
      expect(
        screen.getByText(
          "Souls require lore-derived entities. Write characters into the lore first, then return here to forge them into living voices."
        )
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Go to Lore Scribe" })
      ).toBeDefined();
    });

    it("entities-present CTA differs from no-entities CTA label", () => {
      const { rerender } = render(
        <EmptyState
          variant="souls"
          heading="No souls are bound."
          description="Your archive holds entities waiting to be given voice. Forge them into bound souls who can speak, remember, and reveal."
          ctaLabel="Go to The Archive"
          ctaAction={() => {}}
        />
      );

      expect(
        screen.getByRole("button", { name: "Go to The Archive" })
      ).toBeDefined();

      rerender(
        <EmptyState
          variant="souls"
          heading="No souls are bound."
          description="Souls require lore-derived entities. Write characters into the lore first, then return here to forge them into living voices."
          ctaLabel="Go to Lore Scribe"
          ctaAction={() => {}}
        />
      );

      expect(
        screen.getByRole("button", { name: "Go to Lore Scribe" })
      ).toBeDefined();
    });
  });

  describe("CTA actions navigate to correct sections", () => {
    it("lore CTA fires ctaAction for lore creation", () => {
      const ctaAction = vi.fn();
      render(
        <EmptyState
          variant="lore"
          ctaLabel="Begin Writing"
          ctaAction={ctaAction}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Begin Writing" }));
      expect(ctaAction).toHaveBeenCalledTimes(1);
    });

    it("archive CTA fires ctaAction to navigate to lore section", () => {
      const navigateToLore = vi.fn();
      render(
        <EmptyState
          variant="archive"
          ctaLabel="Go to Lore Scribe"
          ctaAction={navigateToLore}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Go to Lore Scribe" })
      );
      expect(navigateToLore).toHaveBeenCalledTimes(1);
    });

    it("souls CTA (entities present) fires ctaAction to navigate to bible section", () => {
      const navigateToBible = vi.fn();
      render(
        <EmptyState
          variant="souls"
          heading="No souls are bound."
          description="Your archive holds entities waiting to be given voice. Forge them into bound souls who can speak, remember, and reveal."
          ctaLabel="Go to The Archive"
          ctaAction={navigateToBible}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Go to The Archive" })
      );
      expect(navigateToBible).toHaveBeenCalledTimes(1);
    });

    it("souls CTA (no entities) fires ctaAction to navigate to lore section", () => {
      const navigateToLore = vi.fn();
      render(
        <EmptyState
          variant="souls"
          heading="No souls are bound."
          description="Souls require lore-derived entities. Write characters into the lore first, then return here to forge them into living voices."
          ctaLabel="Go to Lore Scribe"
          ctaAction={navigateToLore}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Go to Lore Scribe" })
      );
      expect(navigateToLore).toHaveBeenCalledTimes(1);
    });

    it("tavern CTA fires ctaAction to navigate to souls section", () => {
      const navigateToSouls = vi.fn();
      render(
        <EmptyState
          variant="tavern"
          ctaLabel="Go to Bound Souls"
          ctaAction={navigateToSouls}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Go to Bound Souls" })
      );
      expect(navigateToSouls).toHaveBeenCalledTimes(1);
    });

    it("narrator CTA fires ctaAction to navigate to lore section", () => {
      const navigateToLore = vi.fn();
      render(
        <EmptyState
          icon={<span>Eye</span>}
          heading="The Narrator waits."
          description="Consistency checking and what-if analysis require lore to reason over. Inscribe your world's story first, then the Narrator will have something to examine."
          ctaLabel="Go to Lore Scribe"
          ctaAction={navigateToLore}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Go to Lore Scribe" })
      );
      expect(navigateToLore).toHaveBeenCalledTimes(1);
    });
  });
});
