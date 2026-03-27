export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser, zodErrorResponse, jsonError } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  genre: z.string().max(50).optional(),
  tone: z.string().max(50).optional(),
  premise: z.string().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  // Verify ownership
  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  const { data, error } = await supabase
    .from("worlds")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return Response.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // Verify ownership
  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  // Delete the world (Cascades to souls, lore, entities, etc)
  const { error } = await supabase
    .from("worlds")
    .delete()
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true });
}

