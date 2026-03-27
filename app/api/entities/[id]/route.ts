export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // Verify ownership via worlds
  const { data: entity } = await supabase
    .from("entities")
    .select("id, worlds(user_id)")
    .eq("id", params.id)
    .maybeSingle();

  if (!entity) return jsonError("Entity not found", 404);
  // @ts-ignore
  if (entity.worlds?.user_id !== user.id) return jsonError("Forbidden", 403);

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
  const { name, type, summary } = body;

  const { data: entity } = await supabase
    .from("entities")
    .select("id, worlds(user_id)")
    .eq("id", params.id)
    .maybeSingle();

  if (!entity) return jsonError("Entity not found", 404);
  // @ts-ignore
  if (entity.worlds?.user_id !== user.id) return jsonError("Forbidden", 403);

  const { data, error } = await supabase
    .from("entities")
    .update({ name, type, summary, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true, entity: data });
}
