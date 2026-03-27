export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser, jsonError, zodErrorResponse } from "@/lib/api";

const patchSchema = z.object({
  description: z.string().trim().min(10).max(4000).optional(),
  voice: z.string().trim().min(10).max(1200).optional(),
  core: z.string().trim().min(10).max(1200).optional(),
});

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

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", soul.world_id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  const { error } = await supabase
    .from("souls")
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { data: soul } = await supabase
    .from("souls")
    .select("id, world_id, description, soul_card")
    .eq("id", params.id)
    .maybeSingle();

  if (!soul) return jsonError("Soul not found", 404);

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", soul.world_id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  const currentCard = (soul.soul_card ?? {}) as Record<string, unknown>;
  const nextCard = {
    ...currentCard,
    ...(parsed.data.voice ? { voice: parsed.data.voice } : {}),
    ...(parsed.data.core ? { core: parsed.data.core } : {}),
  };

  const { data, error } = await supabase
    .from("souls")
    .update({
      description: parsed.data.description ?? soul.description,
      soul_card: Object.keys(nextCard).length > 0 ? nextCard : soul.soul_card,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true, soul: data });
}
