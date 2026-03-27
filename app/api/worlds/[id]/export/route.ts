export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

function safeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "_").replace(/^_+|_+$/g, "") || "world";
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: world } = await supabase
    .from("worlds")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id && !world.is_demo) {
    return jsonError("Forbidden", 403);
  }

  const [
    { data: souls },
    { data: entities },
    { data: loreEntries },
    { data: loreFolders },
    { data: relationships },
    { data: checks },
    { data: flags },
    { data: tavernSessions },
    { data: tavernMessages },
    { data: conversations },
  ] = await Promise.all([
    supabase.from("souls").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("entities").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("lore_entries").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("lore_folders").select("*").eq("world_id", params.id).order("sort_order", { ascending: true }),
    supabase.from("entity_relationships").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("consistency_checks").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("consistency_flags").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("tavern_sessions").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("tavern_messages").select("*").eq("world_id", params.id).order("created_at", { ascending: true }),
    supabase.from("conversations").select("*").eq("world_id", params.id).eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  const { data: messages } = conversationIds.length > 0
    ? await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const exportData = {
    version: "2.0",
    exported_at: new Date().toISOString(),
    exported_by: user.id,
    world: {
      id: world.id,
      name: world.name,
      genre: world.genre,
      tone: world.tone,
      premise: world.premise,
      created_at: world.created_at,
      updated_at: world.updated_at,
      is_demo: Boolean(world.is_demo),
    },
    lore: {
      folders: (loreFolders ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id,
        sort_order: folder.sort_order,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
      })),
      entries: (loreEntries ?? []).map((entry) => ({
        id: entry.id,
        title: entry.title,
        folder_id: entry.folder_id ?? null,
        content: entry.content,
        processing_status: entry.processing_status ?? null,
        created_at: entry.created_at,
        updated_at: entry.updated_at ?? null,
      })),
    },
    archive: {
      entities: (entities ?? []).map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        summary: entity.summary,
        mention_count: entity.mention_count ?? null,
        created_at: entity.created_at ?? null,
        updated_at: entity.updated_at ?? null,
      })),
      relationships: relationships ?? [],
    },
    souls: (souls ?? []).map((soul) => ({
      id: soul.id,
      name: soul.name,
      description: soul.description,
      avatar_color: soul.avatar_color,
      avatar_initials: soul.avatar_initials,
      is_active: soul.is_active,
      soul_card: soul.soul_card,
      created_at: soul.created_at,
      updated_at: soul.updated_at,
    })),
    consistency: {
      checks: checks ?? [],
      flags: flags ?? [],
    },
    tavern: {
      sessions: tavernSessions ?? [],
      messages: tavernMessages ?? [],
    },
    direct_chat: {
      conversations: conversations ?? [],
      messages: messages ?? [],
    },
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="grimoire_export_${safeFileName(world.name)}.json"`,
    },
  });
}
