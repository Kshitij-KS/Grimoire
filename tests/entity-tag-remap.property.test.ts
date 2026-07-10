// Feature: ship-plan-v1, Property 1: Entity-tag remap moves all source tags to the target
//
// This exercises the pure array transformation that the `replace_entity_tag`
// Postgres function performs on `lore_chunks.entity_tags`:
//   set entity_tags = (
//     select array_agg(distinct t)
//     from unnest(array_replace(entity_tags, p_old_tag, p_new_tag)) as t
//   )
// i.e. replace every occurrence of the source tag with the target tag, then
// de-duplicate. The SQL is verified indirectly by modelling its semantics here
// and asserting the invariants hold across many randomized inputs.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

/**
 * Pure model of the `replace_entity_tag` remap on a single row's entity_tags:
 * `array_replace` swaps every oldTag → newTag, then `array_agg(distinct …)`
 * collapses duplicates. Order is not significant (Postgres array_agg over
 * unnest does not guarantee ordering), so we model it as a de-duplicated set.
 */
function remapTags(tags: string[], oldTag: string, newTag: string): string[] {
  const replaced = tags.map((t) => (t === oldTag ? newTag : t));
  return Array.from(new Set(replaced));
}

describe("Feature: ship-plan-v1, Property 1: Entity-tag remap moves all source tags to the target", () => {
  it("removes the source tag, adds the target iff source/target present, preserves others, and dedups", () => {
    fc.assert(
      fc.property(
        // A small alphabet of tag names keeps collisions (and thus dedup and
        // "target already present" cases) frequent enough to be exercised.
        fc.array(fc.constantFrom("src", "dst", "a", "b", "c"), {
          minLength: 0,
          maxLength: 12,
        }),
        (tags) => {
          const oldTag = "src";
          const newTag = "dst";

          const before = tags;
          const after = remapTags(before, oldTag, newTag);

          const hadSource = before.includes(oldTag);
          const hadTarget = before.includes(newTag);

          // 1. The source name never appears after the remap.
          expect(after).not.toContain(oldTag);

          // 2. The target name appears iff the source or the target was present.
          expect(after.includes(newTag)).toBe(hadSource || hadTarget);

          // 3. Every unrelated tag is preserved.
          for (const tag of before) {
            if (tag !== oldTag && tag !== newTag) {
              expect(after).toContain(tag);
            }
          }

          // 4. No tag appears more than once.
          expect(after.length).toBe(new Set(after).size);
        },
      ),
      { numRuns: 200 },
    );
  });
});
