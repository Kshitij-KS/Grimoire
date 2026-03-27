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
  // @ts-ignore
  if (soul.worlds?.user_id !== user.id) return jsonError("Forbidden", 403);

  // We must first identify the conversation(s) linked to this soul.
  // In our schema, conversations are linked to world_id and soul_id.
  const { data: convos } = await supabase
    .from("conversations")
    .select("id")
    .eq("soul_id", params.id);

  if (!convos || convos.length === 0) {
    return Response.json({ success: true, message: "No history found." });
  }

  const convoIds = convos.map((c) => c.id);

  // Delete all messages belonging to these conversations.
  // Depending on constraints, messages might have `ON DELETE CASCADE` via conversation_id,
  // but if we just want to WIPE the memory and keep the conversation record, we delete messages.
  const { error } = await supabase
    .from("messages")
    .delete()
    .in("conversation_id", convoIds);

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true });
}
