export const dynamic = "force-dynamic";
import { requireUser, jsonError, zodErrorResponse } from "@/lib/api";
import { z } from "zod";
import { requireWorldAccess } from "@/lib/world-access";

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
    .select("id, world_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!lore) return jsonError("Lore entry not found", 404);

  const access = await requireWorldAccess(supabase, user.id, lore.world_id, "editor");
  if (!access.role) return jsonError("World not found", 404);
  if (!access.allowed) return jsonError("Forbidden", 403);

  const { error } = await supabase
    .from("lore_entries")
    .delete()
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  const parsed = z.object({
    title: z.string().max(200).optional(),
  }).safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { data: lore } = await supabase.from("lore_entries").select("id, world_id").eq("id", params.id).maybeSingle();
  if (!lore) return jsonError("Lore entry not found", 404);

  const access = await requireWorldAccess(supabase, user.id, lore.world_id, "editor");
  if (!access.allowed) return jsonError("Forbidden", 403);

  const { data, error } = await supabase
    .from("lore_entries")
    .update({ title: parsed.data.title })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return Response.json({ success: true, entry: data });
}
