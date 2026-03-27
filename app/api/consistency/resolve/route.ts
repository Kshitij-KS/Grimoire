export const dynamic = "force-dynamic";
import { z } from "zod";
import { jsonError, requireUser, zodErrorResponse } from "@/lib/api";

const schema = z.object({
  id: z.string(),
  resolved: z.boolean().optional(),
});

async function getOwnedFlag(flagId: string) {
  const auth = await requireUser();
  if ("error" in auth) return auth;

  const { user, supabase } = auth;
  const { data: flag, error: fetchError } = await supabase
    .from("consistency_flags")
    .select("id, resolved, checks:consistency_checks(world_id, worlds(user_id))")
    .eq("id", flagId)
    .single();

  if (fetchError || !flag) {
    return { error: jsonError("Flag not found.", 404), supabase, user };
  }

  const checksArr = Array.isArray(flag.checks) ? flag.checks : [flag.checks];
  const worldsArr = checksArr[0]
    ? Array.isArray(checksArr[0].worlds)
      ? checksArr[0].worlds
      : [checksArr[0].worlds]
    : [];
  const ownerId = worldsArr[0]?.user_id;

  if (!ownerId || ownerId !== user.id) {
    return { error: jsonError("Forbidden.", 403), supabase, user };
  }

  return { user, supabase, flag };
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const auth = await getOwnedFlag(parsed.data.id);
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const nextResolved = parsed.data.resolved ?? true;
  const { error } = await supabase
    .from("consistency_flags")
    .update({ resolved: nextResolved })
    .eq("id", parsed.data.id);

  if (error) {
    return jsonError(`Failed to ${nextResolved ? "resolve" : "reopen"} flag.`, 500);
  }

  return Response.json({ success: true, resolved: nextResolved });
}
