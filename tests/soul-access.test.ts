import { describe, expect, it } from "vitest";
import { soulMatchesWorld } from "@/lib/soul-access";
import { roleSatisfies } from "@/lib/world-access";

describe("soulMatchesWorld", () => {
  it("accepts matching world ids", () => {
    expect(soulMatchesWorld("world-1", "world-1")).toBe(true);
  });

  it("rejects mismatched world ids", () => {
    expect(soulMatchesWorld("world-1", "world-2")).toBe(false);
  });
});

describe("roleSatisfies", () => {
  it("allows owners to perform editor and viewer actions", () => {
    expect(roleSatisfies("owner", "editor")).toBe(true);
    expect(roleSatisfies("owner", "viewer")).toBe(true);
  });

  it("allows editors to view and edit but not manage owner-only actions", () => {
    expect(roleSatisfies("editor", "viewer")).toBe(true);
    expect(roleSatisfies("editor", "editor")).toBe(true);
    expect(roleSatisfies("editor", "owner")).toBe(false);
  });

  it("limits viewers to read-only actions", () => {
    expect(roleSatisfies("viewer", "viewer")).toBe(true);
    expect(roleSatisfies("viewer", "editor")).toBe(false);
  });
});
