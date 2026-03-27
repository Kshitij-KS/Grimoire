import { describe, expect, it } from "vitest";
import { soulMatchesWorld } from "@/lib/soul-access";

describe("soulMatchesWorld", () => {
  it("accepts matching world ids", () => {
    expect(soulMatchesWorld("world-1", "world-1")).toBe(true);
  });

  it("rejects mismatched world ids", () => {
    expect(soulMatchesWorld("world-1", "world-2")).toBe(false);
  });
});
