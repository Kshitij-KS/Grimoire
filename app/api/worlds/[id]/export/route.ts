export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // 1. Get the world
  const { data: world } = await supabase
    .from("worlds")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  
  // 2. Verify ownership or demo status
  if (world.user_id !== user.id && !world.is_demo) {
    return jsonError("Forbidden", 403);
  }

  // 3. Fetch all related data in parallel
  const [
    { data: souls },
    { data: entities },
    { data: loreEntries }
  ] = await Promise.all([
    supabase.from("souls").select("*").eq("world_id", params.id),
    supabase.from("entities").select("*").eq("world_id", params.id),
    supabase.from("lore_entries").select("*").eq("world_id", params.id),
  ]);

  // We could also fetch conversations and messages if the user wants chat history,
  // but a "World Bible" usually means the creative context, not the 1-to-1 chats.
  // We'll export the world metadata, components, and lore.

  const exportData = {
    version: "1.0",
    exported_at: new Date().toISOString(),
    world: {
      id: world.id,
      name: world.name,
      genre: world.genre,
      tone: world.tone,
      premise: world.premise,
      created_at: world.created_at,
    },
    souls: souls?.map(s => ({
      name: s.name,
      avatar_color: s.avatar_color,
      avatar_initials: s.avatar_initials,
      soul_card: s.soul_card,
      created_at: s.created_at,
    })) || [],
    entities: entities?.map(e => ({
      name: e.name,
      type: e.type,
      summary: e.summary,
      created_at: e.created_at,
    })) || [],
    lore_entries: loreEntries?.map(l => ({
      title: l.title,
      content: l.content,
      created_at: l.created_at,
    })) || [],
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="grimoire_export_${world.name.replace(/\s+/g, "_").toLowerCase()}.json"`,
    },
  });
}
