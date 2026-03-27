export const dynamic = "force-dynamic";
import { z } from "zod";
import { jsonError, requireUser, zodErrorResponse } from "@/lib/api";

const schema = z.object({
  id: z.string(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { data: flag, error: fetchError } = await supabase
    .from("consistency_flags")
    .select("id, checks:consistency_checks(world_id, worlds(user_id))")
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !flag) {
    return jsonError("Flag not found.", 404);
  }

  const checksArr = Array.isArray(flag.checks) ? flag.checks : [flag.checks];
  const worldsArr = checksArr[0]
    ? Array.isArray(checksArr[0].worlds)
      ? checksArr[0].worlds
      : [checksArr[0].worlds]
    : [];
  const ownerId = worldsArr[0]?.user_id;

  if (!ownerId || ownerId !== user.id) {
    return jsonError("Forbidden.", 403);
  }

  const { error } = await supabase
    .from("consistency_flags")
    .update({ resolved: false })
    .eq("id", parsed.data.id);

  if (error) {
    return jsonError("Failed to unresolve flag.", 500);
  }

  return Response.json({ success: true });
}
