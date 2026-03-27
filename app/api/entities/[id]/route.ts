export const dynamic = "force-dynamic";
import { requireUser, jsonError, zodErrorResponse } from "@/lib/api";
import { entityPatchSchema } from "@/lib/entity-validation";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: entity } = await supabase
    .from("entities")
    .select("id, world_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!entity) return jsonError("Entity not found", 404);

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", entity.world_id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  const { error } = await supabase
    .from("entities")
    .delete()
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json();
  const parsed = entityPatchSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { data: entity } = await supabase
    .from("entities")
    .select("id, world_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!entity) return jsonError("Entity not found", 404);

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", entity.world_id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  const { data, error } = await supabase
    .from("entities")
    .update({
      ...parsed.data,
      summary: parsed.data.summary ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true, entity: data });
}
