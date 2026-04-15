export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

/**
 * DELETE /api/worlds/[id]/members/[userId]
 * Remove a member. World owner only. Cannot remove self.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { id: worldId, userId } = params;

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);
  if (userId === user.id) return jsonError("Cannot remove yourself as owner", 400);

  const { error } = await supabase
    .from("world_members")
    .delete()
    .eq("world_id", worldId)
    .eq("user_id", userId);

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true });
}
