import { describe, expect, it } from "vitest";
import {
  validateContentType,
  isMultipartRoute,
} from "@/lib/middleware/content-type-guard";

function makeRequest(
  method: string,
  contentType?: string,
  url = "http://localhost:3000/api/entities",
): Request {
  const headers = new Headers();
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  return new Request(url, { method, headers });
}

describe("validateContentType", () => {
  it("returns null for GET requests (no validation needed)", () => {
    const req = makeRequest("GET");
    expect(validateContentType(req)).toBeNull();
  });

  it("returns null for OPTIONS requests", () => {
    const req = makeRequest("OPTIONS");
    expect(validateContentType(req)).toBeNull();
  });

  it("returns null for POST with application/json", () => {
    const req = makeRequest("POST", "application/json");
    expect(validateContentType(req)).toBeNull();
  });

  it("returns null for PATCH with application/json; charset=utf-8", () => {
    const req = makeRequest("PATCH", "application/json; charset=utf-8");
    expect(validateContentType(req)).toBeNull();
  });

  it("returns null for DELETE with Application/JSON (case-insensitive)", () => {
    const req = makeRequest("DELETE", "Application/JSON");
    expect(validateContentType(req)).toBeNull();
  });

  it("returns 415 for POST with text/plain", async () => {
    const req = makeRequest("POST", "text/plain");
    const response = validateContentType(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(415);
    const body = await response!.json();
    expect(body.error).toBe("Content-Type must be application/json");
  });

  it("returns 415 for POST with missing Content-Type", async () => {
    const req = makeRequest("POST");
    const response = validateContentType(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(415);
    const body = await response!.json();
    expect(body.error).toBe("Content-Type must be application/json");
  });

  it("returns 415 for DELETE with multipart/form-data on non-excluded route", async () => {
    const req = makeRequest("DELETE", "multipart/form-data");
    const response = validateContentType(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(415);
  });

  it("returns null for POST with multipart/form-data on excluded import route", () => {
    const req = makeRequest(
      "POST",
      "multipart/form-data",
      "http://localhost:3000/api/worlds/123e4567-e89b-12d3-a456-426614174000/import",
    );
    expect(validateContentType(req)).toBeNull();
  });

  it("accepts a pathname override parameter", () => {
    const req = makeRequest("POST", "multipart/form-data", "http://localhost:3000/api/entities");
    // Without override, would fail (not multipart route)
    // With override pointing to import route, should pass
    const result = validateContentType(
      req,
      "/api/worlds/abc-123/import",
    );
    expect(result).toBeNull();
  });
});

describe("isMultipartRoute", () => {
  it("returns true for /api/worlds/[id]/import pattern", () => {
    expect(isMultipartRoute("/api/worlds/some-uuid/import")).toBe(true);
  });

  it("returns false for regular API routes", () => {
    expect(isMultipartRoute("/api/entities")).toBe(false);
    expect(isMultipartRoute("/api/worlds/some-uuid")).toBe(false);
    expect(isMultipartRoute("/api/lore/ingest")).toBe(false);
  });

  it("returns false for routes containing import but not matching pattern", () => {
    expect(isMultipartRoute("/api/worlds/import")).toBe(false);
    expect(isMultipartRoute("/api/worlds/abc/import/extra")).toBe(false);
  });
});
