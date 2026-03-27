export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // We need to verify ownership. Since a soul belongs to a world, and a world belongs to a user.
  // We can do a join to check ownership securely.
  const { data: soul } = await supabase
    .from("souls")
    .select("id, world_id, worlds(user_id)")
    .eq("id", params.id)
    .maybeSingle();

  if (!soul) return jsonError("Soul not found", 404);
  // @ts-ignore - nested join type parsing
  if (soul.worlds?.user_id !== user.id) return jsonError("Forbidden", 403);

  const { error } = await supabase
    .from("souls")
    .delete()
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true });
}
