import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("semantic cache isolation migration", () => {
  it("uses the actual semantic_cache embedding column", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260417000100_fix_semantic_cache_isolation.sql"),
      "utf8",
    );

    expect(sql).not.toContain("prompt_embedding");
    expect(sql).toContain("semantic_cache.embedding <=> query_embedding");
  });
});
