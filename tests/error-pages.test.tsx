// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

// Mock @sentry/nextjs at module level
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock next/link to render a simple anchor
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import * as Sentry from "@sentry/nextjs";
import NotFound from "@/app/not-found";
import ErrorPage from "@/app/error";

describe("NotFound page", () => {
  afterEach(() => {
    cleanup();
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });

  it("renders landing page link when user is unauthenticated", () => {
    render(<NotFound />);

    const link = screen.getByRole("link", { name: /return to home/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders dashboard link when user is authenticated", () => {
    // Set a Supabase-style auth cookie
    document.cookie = "sb-test-project-auth-token=some-token-value";

    render(<NotFound />);

    const link = screen.getByRole("link", { name: /return to dashboard/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/dashboard");
  });

  it("displays page not found message", () => {
    render(<NotFound />);

    expect(screen.getByText("Page Not Found")).toBeDefined();
    expect(screen.getByText("404")).toBeDefined();
  });

  it("displays application branding", () => {
    render(<NotFound />);

    expect(screen.getByText("Grimoire")).toBeDefined();
  });
});

describe("Error page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("calls reset() on first retry button click", () => {
    const mockReset = vi.fn();
    const error = new Error("Test error");

    render(<ErrorPage error={error} reset={mockReset} />);

    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("hides retry button after first reset attempt", () => {
    const mockReset = vi.fn();
    const error = new Error("Test error");

    render(<ErrorPage error={error} reset={mockReset} />);

    // Click retry - this calls reset() and sets hasAttemptedReset to true
    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);

    // After hasAttemptedReset is true: retry button is gone
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("shows persistence message after failed retry", () => {
    const mockReset = vi.fn();
    const error = new Error("Test error");

    render(<ErrorPage error={error} reset={mockReset} />);

    // Click retry
    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);

    // Informational message about error persisting
    expect(
      screen.getByText(/the error persisted after retrying/i)
    ).toBeDefined();
  });

  it("does not call reset() more than once to prevent infinite loops", () => {
    const mockReset = vi.fn();
    const error = new Error("Persistent error");

    render(<ErrorPage error={error} reset={mockReset} />);

    // First click calls reset
    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);
    expect(mockReset).toHaveBeenCalledTimes(1);

    // No retry button exists now, so reset cannot be called again
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    // Ensure reset was only ever called once
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("displays error message from the error object", () => {
    const mockReset = vi.fn();
    const error = new Error("Something went wrong");

    render(<ErrorPage error={error} reset={mockReset} />);

    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("reports error to Sentry on mount", () => {
    const error = new Error("Sentry test");
    render(<ErrorPage error={error} reset={vi.fn()} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("always shows Return to Dashboard link regardless of retry state", () => {
    const mockReset = vi.fn();
    const error = new Error("Test error");

    render(<ErrorPage error={error} reset={mockReset} />);

    // Dashboard link is always visible
    const dashboardLink = screen.getByRole("link", {
      name: /return to dashboard/i,
    });
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.getAttribute("href")).toBe("/dashboard");
  });
});
