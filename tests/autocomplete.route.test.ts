// Route-handler tests for POST /api/lore/autocomplete (Req 7.2, 7.3, 7.4).
//
// Uses a hand-rolled chainable Supabase stub (per the design testing strategy)
// returned from a mocked `createServerSupabaseClient`, since the handler drives
// `requireUser` plus a `checkAndIncrement` rate-limit RPC rather than raw HTTP.
//
// Coverage:
//  - 429 short-circuit when the `autocomplete` limiter reports allowed:false (Req 7.2, 7.3);
//  - provider-accurate error copy (references Groq/HuggingFace, never "GEMINI")
//    when the AI env is absent (Req 7.4).

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  hasAiEnv: vi.fn(),
}));

// Avoid touching the real embeddings/Groq path — the tests never reach generation.
vi.mock("@/lib/embeddings", () => ({
  generateAutocomplete: vi.fn().mockResolvedValue("…the rest of the sentence."),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAiEnv } from "@/lib/env";
import { POST } from "@/app/api/lore/autocomplete/route";
import { DAILY_LIMITS } from "@/lib/constants";

const WORLD_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function makeSupabaseStub({ rateLimitAllowed = true }: { rateLimitAllowed?: boolean } = {}) {
  function makeBuilder() {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: [], error: null }),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const rpc = vi.fn((fn: string) => {
    if (fn === "increment_rate_limit") {
      return Promise.resolve({
        data: [{ allowed: rateLimitAllowed, count: 1, limit: DAILY_LIMITS.autocomplete }],
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    from: vi.fn(() => makeBuilder()),
    rpc,
  };

  return { client, rpc };
}

function autocompleteRequest() {
  return new Request("http://localhost/api/lore/autocomplete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      worldId: WORLD_ID,
      context: "The ancient tower loomed over the valley as dusk settled in.",
      wordCount: 15,
    }),
  });
}

describe("POST /api/lore/autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when the autocomplete limiter is exhausted", async () => {
    vi.mocked(hasAiEnv).mockReturnValue(true);
    const { client } = makeSupabaseStub({ rateLimitAllowed: false });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);

    const response = await POST(autocompleteRequest());

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.action).toBe("autocomplete");
    expect(body.limit).toBe(DAILY_LIMITS.autocomplete);
  });

  it("returns provider-accurate copy (no GEMINI) when the AI env is absent", async () => {
    vi.mocked(hasAiEnv).mockReturnValue(false);
    const { client } = makeSupabaseStub();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);

    const response = await POST(autocompleteRequest());

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("AI_NOT_CONFIGURED");
    expect(body.detail).not.toMatch(/GEMINI/i);
    expect(body.detail).toMatch(/GROQ_API_KEY/);
    expect(body.detail).toMatch(/HuggingFace/);
  });
});
