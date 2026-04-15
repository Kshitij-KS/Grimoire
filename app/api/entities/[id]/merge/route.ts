export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser, jsonError, zodErrorResponse } from "@/lib/api";

const mergeSchema = z.object({
  targetEntityId: z.string().uuid(),
});

/**
 * POST /api/entities/[id]/merge
 * Merges source entity (id) into target entity (targetEntityId).
 *
 * Steps:
 * 1. Validate auth + ownership of both entities
 * 2. Update lore_chunks entity_tags: replace source name with target name
 * 3. Re-point entity_relationships that reference source → target (deduplicate)
 * 4. Add source mention_count to target
 * 5. Delete source entity
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const sourceId = params.id;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { targetEntityId } = parsed.data;

  if (sourceId === targetEntityId) return jsonError("Cannot merge entity into itself", 400);

  // Fetch both entities
  const [sourceRes, targetRes] = await Promise.all([
    supabase.from("entities").select("id, name, world_id, mention_count, user_id").eq("id", sourceId).maybeSingle(),
    supabase.from("entities").select("id, name, world_id, mention_count").eq("id", targetEntityId).maybeSingle(),
  ]);

  const source = sourceRes.data;
  const target = targetRes.data;

  if (!source) return jsonError("Source entity not found", 404);
  if (!target) return jsonError("Target entity not found", 404);
  if (source.world_id !== target.world_id) return jsonError("Entities must be in the same world", 400);

  // Verify ownership
  const { data: world } = await supabase
    .from("worlds")
    .select("user_id")
    .eq("id", source.world_id)
    .maybeSingle();

  if (!world || world.user_id !== user.id) return jsonError("Forbidden", 403);

  // 1. Fetch affected lore_chunks and update entity_tags in JS (Supabase doesn't support array element replacement natively)
  const { data: chunks } = await supabase
    .from("lore_chunks")
    .select("id, entity_tags")
    .eq("world_id", source.world_id)
    .contains("entity_tags", [source.name]);

  if (chunks && chunks.length > 0) {
    const updates = chunks.map((chunk) => ({
      id: chunk.id,
      entity_tags: (chunk.entity_tags as string[]).map((tag: string) =>
        tag === source.name ? target.name : tag,
      ),
    }));
    for (const u of updates) {
      await supabase.from("lore_chunks").update({ entity_tags: u.entity_tags }).eq("id", u.id);
    }
  }

  // 2. Re-point relationships (source → target), avoiding duplicates
  const { data: sourceRels } = await supabase
    .from("entity_relationships")
    .select("id, source_entity_id, target_entity_id")
    .or(`source_entity_id.eq.${sourceId},target_entity_id.eq.${sourceId}`);

  for (const rel of sourceRels ?? []) {
    const newSourceId = rel.source_entity_id === sourceId ? targetEntityId : rel.source_entity_id;
    const newTargetId = rel.target_entity_id === sourceId ? targetEntityId : rel.target_entity_id;

    // Skip self-loops
    if (newSourceId === newTargetId) {
      await supabase.from("entity_relationships").delete().eq("id", rel.id);
      continue;
    }

    // Check for duplicate (already existing relationship between these two)
    const { data: existing } = await supabase
      .from("entity_relationships")
      .select("id")
      .eq("source_entity_id", newSourceId)
      .eq("target_entity_id", newTargetId)
      .maybeSingle();

    if (existing) {
      await supabase.from("entity_relationships").delete().eq("id", rel.id);
    } else {
      await supabase
        .from("entity_relationships")
        .update({ source_entity_id: newSourceId, target_entity_id: newTargetId })
        .eq("id", rel.id);
    }
  }

  // 3. Update target mention_count
  const combinedCount = (source.mention_count ?? 0) + (target.mention_count ?? 0);
  await supabase
    .from("entities")
    .update({ mention_count: combinedCount, updated_at: new Date().toISOString() })
    .eq("id", targetEntityId);

  // 4. Delete source entity
  await supabase.from("entities").delete().eq("id", sourceId);

  const { data: updatedTarget } = await supabase
    .from("entities")
    .select("*")
    .eq("id", targetEntityId)
    .single();

  return Response.json({ target: updatedTarget, sourceId });
}
