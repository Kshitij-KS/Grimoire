import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock @sentry/nextjs before importing the module under test
vi.mock("@sentry/nextjs", () => ({
  setUser: vi.fn(),
  setContext: vi.fn(),
  captureException: vi.fn(),
}));

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  initSentryUser,
  setSentryContext,
  captureApiError,
  extractWorldId,
  withErrorMonitoring,
} from "@/lib/sentry";

describe("initSentryUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches user ID to Sentry scope", () => {
    initSentryUser("user-123");
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: "user-123" });
  });
});

describe("setSentryContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets route path context on Sentry scope", () => {
    setSentryContext("/api/entities");
    expect(Sentry.setContext).toHaveBeenCalledWith("route", {
      path: "/api/entities",
    });
  });

  it("includes world ID when provided", () => {
    setSentryContext("/api/worlds/abc/lore", "abc");
    expect(Sentry.setContext).toHaveBeenCalledWith("route", {
      path: "/api/worlds/abc/lore",
      worldId: "abc",
    });
  });

  it("omits worldId from context when not provided", () => {
    setSentryContext("/api/dashboard");
    const call = vi.mocked(Sentry.setContext).mock.calls[0];
    expect(call[1]).not.toHaveProperty("worldId");
  });
});

describe("extractWorldId", () => {
  it("extracts world UUID from /api/worlds/[uuid] pattern", () => {
    const id = extractWorldId(
      "/api/worlds/123e4567-e89b-12d3-a456-426614174000/lore",
    );
    expect(id).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("extracts world UUID from /worlds/[uuid] pattern", () => {
    const id = extractWorldId(
      "/worlds/abcdef01-2345-6789-abcd-ef0123456789",
    );
    expect(id).toBe("abcdef01-2345-6789-abcd-ef0123456789");
  });

  it("returns undefined when no world ID is in the path", () => {
    expect(extractWorldId("/api/dashboard")).toBeUndefined();
    expect(extractWorldId("/api/entities")).toBeUndefined();
  });

  it("returns undefined for non-UUID segments after /worlds/", () => {
    expect(extractWorldId("/api/worlds/not-a-uuid/lore")).toBeUndefined();
  });
});

describe("captureApiError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 500 status JSON response", async () => {
    const request = new Request("http://localhost:3000/api/entities");
    const error = new Error("Something broke");

    const response = captureApiError(error, request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe(
      "An unexpected error occurred. Please try again.",
    );
  });

  it("does not expose stack traces in the response", async () => {
    const request = new Request("http://localhost:3000/api/entities");
    const error = new Error("Internal DB failure at /lib/db.ts:42");

    const response = captureApiError(error, request);
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain("Internal DB failure");
    expect(JSON.stringify(body)).not.toContain("/lib/db.ts");
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("reports the error to Sentry", () => {
    const request = new Request("http://localhost:3000/api/entities");
    const error = new Error("test error");

    captureApiError(error, request);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("sets route context from the request URL", () => {
    const request = new Request(
      "http://localhost:3000/api/worlds/123e4567-e89b-12d3-a456-426614174000/souls",
    );
    const error = new Error("test");

    captureApiError(error, request);

    expect(Sentry.setContext).toHaveBeenCalledWith("route", {
      path: "/api/worlds/123e4567-e89b-12d3-a456-426614174000/souls",
      worldId: "123e4567-e89b-12d3-a456-426614174000",
    });
  });
});

describe("withErrorMonitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 JSON without stack trace when handler throws", async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

    const handler = async () => {
      throw new Error("Unhandled route error at secret/path.ts:99");
    };

    const wrapped = withErrorMonitoring(handler);
    const request = new Request("http://localhost:3000/api/entities");
    const response = await wrapped(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe(
      "An unexpected error occurred. Please try again.",
    );
    expect(JSON.stringify(body)).not.toContain("secret/path.ts");
    expect(JSON.stringify(body)).not.toContain("Unhandled route error");
  });

  it("attaches authenticated user ID to error reports", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc-123" } },
        }),
      },
    };
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

    const handler = async () => Response.json({ ok: true });

    const wrapped = withErrorMonitoring(handler);
    const request = new Request("http://localhost:3000/api/entities");
    await wrapped(request);

    expect(Sentry.setUser).toHaveBeenCalledWith({ id: "user-abc-123" });
  });

  it("sets route path context on each request", async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

    const handler = async () => Response.json({ ok: true });

    const wrapped = withErrorMonitoring(handler);
    const request = new Request(
      "http://localhost:3000/api/lore/search",
    );
    await wrapped(request);

    expect(Sentry.setContext).toHaveBeenCalledWith("route", {
      path: "/api/lore/search",
    });
  });

  it("attaches world ID from route params as context metadata", async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

    const handler = async () => Response.json({ ok: true });

    const wrapped = withErrorMonitoring(handler);
    const request = new Request(
      "http://localhost:3000/api/worlds/deadbeef-1234-5678-abcd-ef0123456789/lore",
    );
    await wrapped(request);

    expect(Sentry.setContext).toHaveBeenCalledWith("route", {
      path: "/api/worlds/deadbeef-1234-5678-abcd-ef0123456789/lore",
      worldId: "deadbeef-1234-5678-abcd-ef0123456789",
    });
  });

  it("does not fail if auth context cannot be retrieved", async () => {
    vi.mocked(createServerSupabaseClient).mockImplementation(() => {
      throw new Error("Missing Supabase environment variables.");
    });

    const handler = async () => Response.json({ ok: true });

    const wrapped = withErrorMonitoring(handler);
    const request = new Request("http://localhost:3000/api/entities");
    const response = await wrapped(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("passes through successful handler responses", async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as any);

    const handler = async () =>
      Response.json({ data: "hello" }, { status: 201 });

    const wrapped = withErrorMonitoring(handler);
    const request = new Request("http://localhost:3000/api/entities");
    const response = await wrapped(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toBe("hello");
  });
});
