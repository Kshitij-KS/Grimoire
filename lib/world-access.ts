import type { SupabaseClient } from "@supabase/supabase-js";

export async function userOwnsWorld(
  supabase: SupabaseClient,
  userId: string,
  worldId: string,
): Promise<boolean> {
  const { data: world } = await supabase
    .from("worlds")
    .select("id")
    .eq("id", worldId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(world);
}
