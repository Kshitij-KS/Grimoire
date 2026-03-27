export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser, zodErrorResponse } from "@/lib/api";

const createSchema = z.object({
  worldId: z.string().uuid(),
  sourceEntityId: z.string().uuid(),
  targetEntityId: z.string().uuid(),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId");

  if (!worldId) return Response.json({ error: "Missing worldId" }, { status: 400 });

  const { data: relationships } = await supabase
    .from("entity_relationships")
    .select(`
      *,
      source_entity:entities!entity_relationships_source_entity_id_fkey(id, name, type),
      target_entity:entities!entity_relationships_target_entity_id_fkey(id, name, type)
    `)
    .eq("world_id", worldId);

  return Response.json({ relationships: relationships ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;
  const body = await request.json();

  if (body.action === "delete") {
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const { error } = await supabase
      .from("entity_relationships")
      .delete()
      .eq("id", parsed.data.id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  // Prevent self-referencing
  if (parsed.data.sourceEntityId === parsed.data.targetEntityId) {
    return Response.json({ error: "Cannot create self-referencing relationship" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("entity_relationships")
    .insert({
      world_id: parsed.data.worldId,
      user_id: user.id,
      source_entity_id: parsed.data.sourceEntityId,
      target_entity_id: parsed.data.targetEntityId,
      label: parsed.data.label,
      description: parsed.data.description ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Relationship already exists" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ relationship: data });
}
