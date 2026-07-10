// Route-handler tests for POST /api/demo/chat (Req 8.1, 8.2, 8.3).
//
// The demo chat handler is public/unauthenticated and streams from Groq. These
// tests mock the Groq streaming path so the network is never touched, and use
// the real in-memory limiter from `lib/rate-limit-ip` (reset between tests) to
// assert the per-IP throttle and the global daily cap both reject with 429.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  hasAiEnv: vi.fn(() => true),
}));

// Mock the Groq streaming path: an async iterable that yields a single chunk,
// so allowed requests succeed without any network access.
vi.mock("@/lib/groq", () => ({
  GROQ_MODEL_FAST: "llama-3.1-8b-instant",
  groqStream: vi.fn(async () => ({
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: "Hello." } }] };
    },
  })),
}));

import { POST } from "@/app/api/demo/chat/route";
import { groqStream } from "@/lib/groq";
import {
  checkGlobalDailyCap,
  __resetRateLimitStores,
} from "@/lib/rate-limit-ip";

function demoRequest(ip: string) {
  return new Request("http://localhost/api/demo/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ message: "Tell me about the valley." }),
  });
}

describe("POST /api/demo/chat throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStores();
  });

  it("allows up to the per-IP max then rejects with 429 RATE_LIMITED", async () => {
    const ip = "203.0.113.42";

    // The per-IP window allows 8 requests; all 8 should succeed (200).
    for (let i = 0; i < 8; i++) {
      const res = await POST(demoRequest(ip));
      expect(res.status).toBe(200);
    }

    // The 9th request from the same IP within the window is throttled.
    const throttled = await POST(demoRequest(ip));
    expect(throttled.status).toBe(429);
    const body = await throttled.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.retryAfter).toBeGreaterThan(0);

    // Groq was only invoked for the allowed requests, never for the throttled one.
    expect(vi.mocked(groqStream)).toHaveBeenCalledTimes(8);
  });

  it("rejects with 429 DEMO_UNAVAILABLE once the global daily cap is reached", async () => {
    // Exhaust the global daily counter for the demo_chat key (cap = 5_000),
    // matching the value enforced by the handler.
    for (let i = 0; i < 5_000; i++) {
      checkGlobalDailyCap("demo_chat", 5_000);
    }

    // A fresh IP passes the per-IP check but trips the global circuit breaker.
    const res = await POST(demoRequest("198.51.100.9"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("DEMO_UNAVAILABLE");

    // The global cap short-circuits before Groq is ever called.
    expect(vi.mocked(groqStream)).not.toHaveBeenCalled();
  });
});
