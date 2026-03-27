export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser, zodErrorResponse } from "@/lib/api";

const createSchema = z.object({
  worldId: z.string().uuid(),
  name: z.string().min(1).max(80),
  parentId: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().optional(),
});

const moveEntrySchema = z.object({
  entryId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
});

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId");

  if (!worldId) return Response.json({ error: "Missing worldId" }, { status: 400 });

  const { data: folders } = await supabase
    .from("lore_folders")
    .select("*")
    .eq("world_id", worldId)
    .order("sort_order", { ascending: true });

  return Response.json({ folders: folders ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;
  const body = await request.json();

  // Move lore entry to folder
  if (body.action === "move-entry") {
    const parsed = moveEntrySchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const { error } = await supabase
      .from("lore_entries")
      .update({ folder_id: parsed.data.folderId })
      .eq("id", parsed.data.entryId);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // Update folder
  if (body.action === "update") {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.parentId !== undefined) update.parent_id = parsed.data.parentId;
    if (parsed.data.sortOrder !== undefined) update.sort_order = parsed.data.sortOrder;

    const { data, error } = await supabase
      .from("lore_folders")
      .update(update)
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ folder: data });
  }

  // Create folder
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { data, error } = await supabase
    .from("lore_folders")
    .insert({
      world_id: parsed.data.worldId,
      user_id: user.id,
      name: parsed.data.name,
      parent_id: parsed.data.parentId ?? null,
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ folder: data });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  // Move entries in this folder to root before deleting
  await supabase
    .from("lore_entries")
    .update({ folder_id: null })
    .eq("folder_id", id);

  const { error } = await supabase.from("lore_folders").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
