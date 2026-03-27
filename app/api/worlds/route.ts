export const dynamic = "force-dynamic";
import { z } from "zod";
import { FREE_TIER_LIMITS } from "@/lib/constants";
import { jsonError, zodErrorResponse } from "@/lib/api";
import { requireUser } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2),
  genre: z.string().min(1),
  tone: z.string().min(1),
  premise: z.string().min(10).max(280),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;

  const [{ count: worldCount }, { data: profile }] = await Promise.all([
    supabase.from("worlds").select("*", { head: true, count: "exact" }).eq("user_id", user.id),
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
  ]);

  const isFree = !profile || profile.plan === "free";
  if (isFree && (worldCount ?? 0) >= FREE_TIER_LIMITS.worlds) {
    return jsonError("FREE_WORLD_LIMIT_REACHED", 403);
  }

  const { data: world, error } = await supabase
    .from("worlds")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      genre: parsed.data.genre,
      tone: parsed.data.tone,
      premise: parsed.data.premise,
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return Response.json({ success: true, world });
}
