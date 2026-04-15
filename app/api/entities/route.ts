export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser, jsonError, zodErrorResponse } from "@/lib/api";
import { entityTypeValues } from "@/lib/entity-validation";

const createEntitySchema = z.object({
  worldId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(entityTypeValues),
  summary: z.string().trim().max(3000).optional(),
});

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

/**
 * POST /api/entities
 * Manually create an entity: { worldId, name, type, summary? }
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = createEntitySchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { worldId, name, type, summary } = parsed.data;

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  // Normalize name for deduplication
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, " ");

  const { data: entity, error } = await supabase
    .from("entities")
    .insert({
      world_id: worldId,
      user_id: user.id,
      name: name.trim(),
      normalized_name: normalizedName,
      type,
      summary: summary ?? null,
      mention_count: 0,
      first_mentioned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return jsonError("An entity with this name and type already exists", 409);
    return jsonError(error.message, 500);
  }

  return Response.json({ entity }, { status: 201 });
}
