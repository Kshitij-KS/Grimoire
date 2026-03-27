export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

/**
 * GET /api/entities?worldId=<id>&since=<ISO timestamp>
 *
 * Returns entities for a world. If `since` is provided, only returns
 * entities created or updated after that timestamp (incremental refresh).
 * If no `since`, returns all entities for the world.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId");
  const since = searchParams.get("since");

  if (!worldId) return jsonError("worldId is required", 400);

  // Verify world ownership
  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  let query = supabase
    .from("entities")
    .select("*")
    .eq("world_id", worldId)
    .order("updated_at", { ascending: false });

  if (since) {
    query = query.gt("updated_at", since);
  }

  const { data: entities, error } = await query;

  if (error) return jsonError(error.message, 500);

  return Response.json({ entities: entities ?? [], since: since ?? null });
}
