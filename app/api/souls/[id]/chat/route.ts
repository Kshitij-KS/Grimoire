export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";
import { requireWorldAccess } from "@/lib/world-access";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: soul } = await supabase
    .from("souls")
    .select("id, world_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!soul) return jsonError("Soul not found", 404);
  const access = await requireWorldAccess(supabase, user.id, soul.world_id, "editor");
  if (!access.role) return jsonError("World not found", 404);
  if (!access.allowed) return jsonError("Forbidden", 403);

  const { data: convos } = await supabase
    .from("conversations")
    .select("id")
    .eq("soul_id", params.id);

  if (!convos || convos.length === 0) {
    return Response.json({ success: true, message: "No history found." });
  }

  const convoIds = (convos as Array<{ id: string }>).map((c) => c.id);

  const { error: messageError } = await supabase
    .from("messages")
    .delete()
    .in("conversation_id", convoIds);

  if (messageError) return jsonError(messageError.message, 500);

  const { error: convoError } = await supabase
    .from("conversations")
    .update({
      compressed_history: null,
      last_active: new Date().toISOString(),
    })
    .in("id", convoIds);

  if (convoError) return jsonError(convoError.message, 500);

  return Response.json({ success: true });
}
