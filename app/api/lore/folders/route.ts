export const dynamic = "force-dynamic";
import { z } from "zod";
import { jsonError, requireUser, zodErrorResponse } from "@/lib/api";
import { userOwnsWorld } from "@/lib/world-access";

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
  if (!z.string().uuid().safeParse(worldId).success) return jsonError("INVALID_WORLD_ID", 400);

  const ownsWorld = await userOwnsWorld(supabase, auth.user.id, worldId);
  if (!ownsWorld) return jsonError("FORBIDDEN", 403);

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  // Move lore entry to folder
  if (typeof body === "object" && body !== null && "action" in body && (body as { action: unknown }).action === "move-entry") {
    const parsed = moveEntrySchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const { data: entry } = await supabase
      .from("lore_entries")
      .select("id, world_id")
      .eq("id", parsed.data.entryId)
      .maybeSingle();
    if (!entry) return jsonError("LORE_ENTRY_NOT_FOUND", 404);

    const ownsEntryWorld = await userOwnsWorld(supabase, user.id, entry.world_id);
    if (!ownsEntryWorld) return jsonError("FORBIDDEN", 403);

    if (parsed.data.folderId) {
      const { data: folder } = await supabase
        .from("lore_folders")
        .select("id, world_id")
        .eq("id", parsed.data.folderId)
        .maybeSingle();

      if (!folder) return jsonError("FOLDER_NOT_FOUND", 404);
      if (folder.world_id !== entry.world_id) return jsonError("FOLDER_WORLD_MISMATCH", 400);
    }

    const { error } = await supabase
      .from("lore_entries")
      .update({ folder_id: parsed.data.folderId })
      .eq("id", parsed.data.entryId);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // Update folder
  if (typeof body === "object" && body !== null && "action" in body && (body as { action: unknown }).action === "update") {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const { data: folder } = await supabase
      .from("lore_folders")
      .select("id, world_id")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!folder) return jsonError("FOLDER_NOT_FOUND", 404);

    const ownsWorld = await userOwnsWorld(supabase, user.id, folder.world_id);
    if (!ownsWorld) return jsonError("FORBIDDEN", 403);

    if (parsed.data.parentId) {
      const { data: parentFolder } = await supabase
        .from("lore_folders")
        .select("id, world_id")
        .eq("id", parsed.data.parentId)
        .maybeSingle();

      if (!parentFolder) return jsonError("PARENT_FOLDER_NOT_FOUND", 404);
      if (parentFolder.world_id !== folder.world_id) return jsonError("FOLDER_WORLD_MISMATCH", 400);
    }

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

  const ownsWorld = await userOwnsWorld(supabase, user.id, parsed.data.worldId);
  if (!ownsWorld) return jsonError("FORBIDDEN", 403);

  if (parsed.data.parentId) {
    const { data: parentFolder } = await supabase
      .from("lore_folders")
      .select("id, world_id")
      .eq("id", parsed.data.parentId)
      .maybeSingle();

    if (!parentFolder) return jsonError("PARENT_FOLDER_NOT_FOUND", 404);
    if (parentFolder.world_id !== parsed.data.worldId) return jsonError("FOLDER_WORLD_MISMATCH", 400);
  }

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

  const { user, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { data: folder } = await supabase
    .from("lore_folders")
    .select("id, world_id")
    .eq("id", id)
    .maybeSingle();

  if (!folder) return jsonError("FOLDER_NOT_FOUND", 404);

  const ownsWorld = await userOwnsWorld(supabase, user.id, folder.world_id);
  if (!ownsWorld) return jsonError("FORBIDDEN", 403);

  // Move entries in this folder to root before deleting
  await supabase
    .from("lore_entries")
    .update({ folder_id: null })
    .eq("folder_id", id);

  const { error } = await supabase.from("lore_folders").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
