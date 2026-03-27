import { describe, expect, it } from "vitest";
import { entityPatchSchema } from "@/lib/entity-validation";

describe("entityPatchSchema", () => {
  it("accepts a valid patch payload", () => {
    expect(
      entityPatchSchema.safeParse({
        name: "The Hollow Queen",
        type: "character",
        summary: "A ruler of the ash plains.",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid entity types", () => {
    expect(
      entityPatchSchema.safeParse({
        name: "Ashveil",
        type: "planet",
        summary: "Not a valid entity type.",
      }).success,
    ).toBe(false);
  });
});
