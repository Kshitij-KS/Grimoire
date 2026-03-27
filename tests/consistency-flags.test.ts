import { describe, expect, it } from "vitest";
import { partitionConsistencyFlags, toggleConsistencyFlagResolved } from "@/lib/consistency-flags";
import type { ConsistencyFlag } from "@/lib/types";

const sampleFlags: ConsistencyFlag[] = [
  {
    id: "flag-1",
    world_id: "world-1",
    check_id: null,
    flagged_text: "A",
    contradiction: "Mismatch",
    existing_reference: null,
    severity: "medium",
    resolved: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "flag-2",
    world_id: "world-1",
    check_id: null,
    flagged_text: "B",
    contradiction: "Mismatch",
    existing_reference: null,
    severity: "low",
    resolved: true,
    created_at: new Date().toISOString(),
  },
];

describe("consistency flag helpers", () => {
  it("partitions active and resolved flags", () => {
    const { active, resolved } = partitionConsistencyFlags(sampleFlags);
    expect(active).toHaveLength(1);
    expect(resolved).toHaveLength(1);
  });

  it("toggles resolution state immutably", () => {
    const next = toggleConsistencyFlagResolved(sampleFlags, "flag-1", true);
    expect(next[0].resolved).toBe(true);
    expect(sampleFlags[0].resolved).toBe(false);
  });
});
