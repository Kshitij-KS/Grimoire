export const dynamic = "force-dynamic";
import { z } from "zod";
import { jsonError, requireUser, zodErrorResponse } from "@/lib/api";
import { requireWorldAccess } from "@/lib/world-access";

const schema = z.object({
  worldId: z.string().uuid(),
  primaryEntityId: z.string().uuid(),
  secondaryEntityId: z.string().uuid(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;
  const { worldId, primaryEntityId, secondaryEntityId } = parsed.data;

  if (primaryEntityId === secondaryEntityId) {
    return jsonError("CANNOT_MERGE_SELF", 400);
  }

  const access = await requireWorldAccess(supabase, user.id, worldId, "editor");
  if (!access.allowed) return jsonError("FORBIDDEN", 403);

  // Verify both entities exist in this world
  const { data: entities } = await supabase
    .from("entities")
    .select("id, name, world_id, user_id")
    .in("id", [primaryEntityId, secondaryEntityId])
    .eq("world_id", worldId);

  if (!entities || entities.length !== 2) {
    return jsonError("ENTITY_NOT_FOUND", 404);
  }

  const primary = entities.find((e: { id: string }) => e.id === primaryEntityId)!;
  const secondary = entities.find((e: { id: string }) => e.id === secondaryEntityId)!;
  const primaryName = (primary as { name: string }).name;
  const secondaryName = (secondary as { name: string }).name;

  // ── 1. Re-point relationships with deduplication ───────────────────────
  // Fetch secondary's relationships to re-insert with primary
  const { data: secondaryRelationships } = await supabase
    .from("entity_relationships")
    .select("*")
    .or(`source_entity_id.eq.${secondaryEntityId},target_entity_id.eq.${secondaryEntityId}`);

  // Delete all relationships involving secondary (clean slate)
  await supabase
    .from("entity_relationships")
    .delete()
    .or(`source_entity_id.eq.${secondaryEntityId},target_entity_id.eq.${secondaryEntityId}`);

  // Re-insert with primary, skip duplicates
  if (secondaryRelationships && secondaryRelationships.length > 0) {
    // Check which of secondary's relationships already exist (by target or source)
    const { data: existingRelationships } = await supabase
      .from("entity_relationships")
      .select("source_entity_id, target_entity_id")
      .or(`source_entity_id.eq.${primaryEntityId},target_entity_id.eq.${primaryEntityId}`)
      .eq("world_id", worldId);

    const existingPairs = new Set(
      (existingRelationships ?? []).map(
        (r: { source_entity_id: string; target_entity_id: string }) =>
          `${r.source_entity_id}-${r.target_entity_id}`
      )
    );

    const rowsToInsert = secondaryRelationships
      .map((r: { source_entity_id: string; target_entity_id: string; label: string; description: string | null; tension_score: number }) => ({
        world_id: worldId,
        user_id: user.id,
        source_entity_id: r.source_entity_id === secondaryEntityId ? primaryEntityId : r.source_entity_id,
        target_entity_id: r.target_entity_id === secondaryEntityId ? primaryEntityId : r.target_entity_id,
        label: r.label,
        description: r.description,
        tension_score: r.tension_score,
      }))
      .filter((r: { source_entity_id: string; target_entity_id: string }) => {
        // Skip if this would duplicate an existing or self-referencing relationship
        return r.source_entity_id !== r.target_entity_id &&
          !existingPairs.has(`${r.source_entity_id}-${r.target_entity_id}`);
      });

    if (rowsToInsert.length > 0) {
      await supabase.from("entity_relationships").insert(rowsToInsert);
    }
  }

  // ── 2. Re-point lore_chunks.entity_id → primary ────────────────────────
  await supabase
    .from("lore_chunks")
    .update({ entity_id: primaryEntityId })
    .eq("entity_id", secondaryEntityId);

  // ── 3. Remap entity_tags text array (best-effort) ──────────────────────
  if (secondaryName !== primaryName) {
    await supabase.rpc("replace_entity_tag", {
      p_world_id: worldId,
      p_old_tag: secondaryName,
      p_new_tag: primaryName,
    }).then(() => {/* ignore if function doesn't exist yet */});
  }

  // ── 4. Merge mention_count into primary ────────────────────────────────
  const primaryMentions = (primary as { mention_count?: number }).mention_count ?? 0;
  const secondaryMentions = (secondary as { mention_count?: number }).mention_count ?? 0;

  await supabase
    .from("entities")
    .update({ mention_count: primaryMentions + secondaryMentions })
    .eq("id", primaryEntityId);

  // ── 5. Delete secondary entity ─────────────────────────────────────────
  const { error: deleteError } = await supabase
    .from("entities")
    .delete()
    .eq("id", secondaryEntityId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    mergedInto: primaryEntityId,
    deletedEntity: secondaryEntityId,
    primaryName,
    secondaryName,
  });
}
