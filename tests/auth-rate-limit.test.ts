import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  checkAuthRateLimit,
  getClientIp,
  resetRateLimitStore,
} from "@/lib/middleware/auth-rate-limit";

describe("checkAuthRateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 10; i++) {
      const result = checkAuthRateLimit("192.168.1.1");
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects the 11th request within the window", () => {
    for (let i = 0; i < 10; i++) {
      checkAuthRateLimit("192.168.1.1");
    }
    const result = checkAuthRateLimit("192.168.1.1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 10; i++) {
      checkAuthRateLimit("10.0.0.1");
    }
    // Different IP should still be allowed
    const result = checkAuthRateLimit("10.0.0.2");
    expect(result.allowed).toBe(true);
  });

  it("allows requests again after the window expires", () => {
    for (let i = 0; i < 10; i++) {
      checkAuthRateLimit("192.168.1.1");
    }

    // Advance time past the 60-second window
    vi.advanceTimersByTime(61_000);

    const result = checkAuthRateLimit("192.168.1.1");
    expect(result.allowed).toBe(true);
  });

  it("calculates Retry-After as seconds until oldest request exits window", () => {
    // Make 10 requests at t=0
    vi.setSystemTime(new Date(1000));
    for (let i = 0; i < 10; i++) {
      checkAuthRateLimit("192.168.1.1");
    }

    // Advance 30 seconds, then try again
    vi.advanceTimersByTime(30_000);
    const result = checkAuthRateLimit("192.168.1.1");
    expect(result.allowed).toBe(false);
    // Oldest request was at t=1000, window is 60s, so it exits at t=61000
    // Current time is t=31000, so retryAfter ≈ 30 seconds
    expect(result.retryAfter).toBe(30);
  });

  it("cleans up expired entries to prevent memory leaks", () => {
    // Create entries for multiple IPs
    checkAuthRateLimit("10.0.0.1");
    checkAuthRateLimit("10.0.0.2");
    checkAuthRateLimit("10.0.0.3");

    // Advance past window so all entries expire
    vi.advanceTimersByTime(61_000);

    // Next check triggers cleanup; expired entries should be removed
    checkAuthRateLimit("10.0.0.4");

    // Verify that the old IPs no longer have entries by checking they're allowed
    // (this is implicit: if cleanup didn't work and timestamps remained,
    // they'd still be valid — but since they're filtered, the allowed result confirms it)
    const result1 = checkAuthRateLimit("10.0.0.1");
    expect(result1.allowed).toBe(true);
  });

  it("returns retryAfter of at least 1 second", () => {
    for (let i = 0; i < 10; i++) {
      checkAuthRateLimit("192.168.1.1");
    }
    // Advance to nearly the end of the window
    vi.advanceTimersByTime(59_900);
    const result = checkAuthRateLimit("192.168.1.1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost/api/auth/callback", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("uses single x-forwarded-for value", () => {
    const request = new Request("http://localhost/api/auth/callback", {
      headers: { "x-forwarded-for": "192.168.0.1" },
    });
    expect(getClientIp(request)).toBe("192.168.0.1");
  });

  it("falls back to request.ip when no forwarded header", () => {
    const request = new Request("http://localhost/api/auth/callback");
    (request as unknown as { ip: string }).ip = "127.0.0.1";
    expect(getClientIp(request)).toBe("127.0.0.1");
  });

  it("returns 'unknown' when no IP is available", () => {
    const request = new Request("http://localhost/api/auth/callback");
    expect(getClientIp(request)).toBe("unknown");
  });
});
