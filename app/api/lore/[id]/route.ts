export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // Verify ownership
  const { data: lore } = await supabase
    .from("lore_entries")
    .select("id, worlds(user_id)")
    .eq("id", params.id)
    .maybeSingle();

  if (!lore) return jsonError("Lore entry not found", 404);
  // @ts-ignore
  if (lore.worlds?.user_id !== user.id) return jsonError("Forbidden", 403);

  const { error } = await supabase
    .from("lore_entries")
    .delete()
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true });
}
