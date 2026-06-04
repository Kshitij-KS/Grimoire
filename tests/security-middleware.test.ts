import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  checkAuthRateLimit,
  resetRateLimitStore,
  getClientIp,
  type RateLimitResult,
} from "@/lib/middleware/auth-rate-limit";
import {
  applySecurityHeaders,
  SECURITY_HEADERS,
  X_CONTENT_TYPE_OPTIONS,
  X_FRAME_OPTIONS,
  REFERRER_POLICY,
  PERMISSIONS_POLICY,
  STRICT_TRANSPORT_SECURITY,
} from "@/lib/middleware/security-headers";

// ─── Auth Rate Limiter ──────────────────────────────────────────────────────

describe("checkAuthRateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("sliding window allows requests under limit", () => {
    it("allows the first request from a new IP", () => {
      const result = checkAuthRateLimit("192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it("allows up to 10 requests within the window", () => {
      for (let i = 0; i < 10; i++) {
        const result = checkAuthRateLimit("192.168.1.2");
        expect(result.allowed).toBe(true);
      }
    });

    it("allows requests from different IPs independently", () => {
      // Fill up IP-A to the limit
      for (let i = 0; i < 10; i++) {
        checkAuthRateLimit("ip-a");
      }
      // IP-B should still be allowed
      const result = checkAuthRateLimit("ip-b");
      expect(result.allowed).toBe(true);
    });
  });

  describe("sliding window rejects requests over limit", () => {
    it("rejects the 11th request from the same IP", () => {
      for (let i = 0; i < 10; i++) {
        checkAuthRateLimit("192.168.1.3");
      }
      const result = checkAuthRateLimit("192.168.1.3");
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it("continues rejecting subsequent requests while window is full", () => {
      for (let i = 0; i < 10; i++) {
        checkAuthRateLimit("192.168.1.4");
      }
      // Multiple subsequent requests should all be rejected
      for (let i = 0; i < 3; i++) {
        const result = checkAuthRateLimit("192.168.1.4");
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe("Retry-After header calculation", () => {
    it("returns retryAfter in seconds when over limit", () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      // Fill the window
      for (let i = 0; i < 10; i++) {
        checkAuthRateLimit("retry-ip");
      }

      // Now we're at the same time, 11th request should be rejected
      const result = checkAuthRateLimit("retry-ip");
      expect(result.allowed).toBe(false);
      // The oldest timestamp was at baseTime, so retryAfter should be ~60s
      expect(result.retryAfter).toBe(60);
    });

    it("retryAfter decreases as time passes", () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      // Fill the window
      for (let i = 0; i < 10; i++) {
        checkAuthRateLimit("retry-ip-2");
      }

      // Advance 30 seconds
      vi.setSystemTime(baseTime + 30_000);

      const result = checkAuthRateLimit("retry-ip-2");
      expect(result.allowed).toBe(false);
      // Oldest request was at baseTime, window is 60s, so retryAfter = 60 - 30 = 30s
      expect(result.retryAfter).toBe(30);
    });

    it("retryAfter is at least 1 second", () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      for (let i = 0; i < 10; i++) {
        checkAuthRateLimit("retry-ip-3");
      }

      // Advance to just before the window expires (59.9 seconds)
      vi.setSystemTime(baseTime + 59_900);

      const result = checkAuthRateLimit("retry-ip-3");
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it("allows requests again after the window expires", () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      // Fill the window
      for (let i = 0; i < 10; i++) {
        checkAuthRateLimit("retry-ip-4");
      }

      // Advance past the 60-second window
      vi.setSystemTime(baseTime + 61_000);

      const result = checkAuthRateLimit("retry-ip-4");
      expect(result.allowed).toBe(true);
    });
  });

  describe("expired entry cleanup", () => {
    it("cleans up expired timestamps on each check", () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      // Make 5 requests from IP-A
      for (let i = 0; i < 5; i++) {
        checkAuthRateLimit("cleanup-ip");
      }

      // Advance past the window so all entries expire
      vi.setSystemTime(baseTime + 61_000);

      // The next request should be allowed (old entries cleaned up)
      const result = checkAuthRateLimit("cleanup-ip");
      expect(result.allowed).toBe(true);
    });

    it("partially expired entries allow more requests", () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      // Make 8 requests
      for (let i = 0; i < 8; i++) {
        checkAuthRateLimit("partial-cleanup-ip");
      }

      // Advance 30 seconds, make 2 more (still under limit with 8 initial)
      vi.setSystemTime(baseTime + 30_000);
      checkAuthRateLimit("partial-cleanup-ip");
      checkAuthRateLimit("partial-cleanup-ip");

      // Now at 10 total in window, next should be rejected
      const result = checkAuthRateLimit("partial-cleanup-ip");
      expect(result.allowed).toBe(false);

      // Advance past initial 8 requests' window (>60s from baseTime)
      vi.setSystemTime(baseTime + 61_000);

      // Now only the 2 requests from baseTime+30s remain, so we have room
      const resultAfter = checkAuthRateLimit("partial-cleanup-ip");
      expect(resultAfter.allowed).toBe(true);
    });

    it("removes IP entries entirely when all timestamps expire", () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      // Make requests from multiple IPs
      checkAuthRateLimit("temp-ip-1");
      checkAuthRateLimit("temp-ip-2");

      // Advance past window
      vi.setSystemTime(baseTime + 61_000);

      // Trigger cleanup by checking any IP
      checkAuthRateLimit("trigger-ip");

      // Previous IPs should be allowed (entries were cleaned up)
      const r1 = checkAuthRateLimit("temp-ip-1");
      const r2 = checkAuthRateLimit("temp-ip-2");
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    });
  });
});

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("returns single IP from x-forwarded-for", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("10.0.0.1");
  });

  it("falls back to request.ip when no x-forwarded-for", () => {
    const request = new Request("http://localhost/api/auth/login") as Request & { ip?: string };
    (request as { ip?: string }).ip = "127.0.0.1";
    expect(getClientIp(request)).toBe("127.0.0.1");
  });

  it("returns 'unknown' when no IP info available", () => {
    const request = new Request("http://localhost/api/auth/login");
    expect(getClientIp(request)).toBe("unknown");
  });
});

// ─── Security Headers ───────────────────────────────────────────────────────

describe("applySecurityHeaders", () => {
  it("sets X-Content-Type-Options: nosniff", () => {
    const response = new Response("OK");
    applySecurityHeaders(response, false);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options: DENY", () => {
    const response = new Response("OK");
    applySecurityHeaders(response, false);
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets Referrer-Policy: strict-origin-when-cross-origin", () => {
    const response = new Response("OK");
    applySecurityHeaders(response, false);
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("sets Permissions-Policy: camera=(), microphone=(), geolocation=()", () => {
    const response = new Response("OK");
    applySecurityHeaders(response, false);
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("does NOT set Strict-Transport-Security in non-production", () => {
    const response = new Response("OK");
    applySecurityHeaders(response, false);
    expect(response.headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("sets Strict-Transport-Security in production", () => {
    const response = new Response("OK");
    applySecurityHeaders(response, true);
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("applies all required security headers on a single response", () => {
    const response = new Response("OK");
    applySecurityHeaders(response, true);

    // Verify all headers are present
    expect(response.headers.get("X-Content-Type-Options")).toBe(X_CONTENT_TYPE_OPTIONS);
    expect(response.headers.get("X-Frame-Options")).toBe(X_FRAME_OPTIONS);
    expect(response.headers.get("Referrer-Policy")).toBe(REFERRER_POLICY);
    expect(response.headers.get("Permissions-Policy")).toBe(PERMISSIONS_POLICY);
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      STRICT_TRANSPORT_SECURITY,
    );
  });

  it("exported SECURITY_HEADERS contains all non-HSTS headers", () => {
    expect(SECURITY_HEADERS).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });
});
