import type { SupabaseClient } from "@supabase/supabase-js";

export type WorldAccessRole = "owner" | "editor" | "viewer";

const roleRank: Record<WorldAccessRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function roleSatisfies(role: WorldAccessRole | null, minimumRole: WorldAccessRole) {
  if (!role) return false;
  return roleRank[role] >= roleRank[minimumRole];
}

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

export async function getWorldAccessRole(
  supabase: SupabaseClient,
  userId: string,
  worldId: string,
): Promise<WorldAccessRole | null> {
  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) return null;
  if ((world as { user_id?: string }).user_id === userId) return "owner";

  const { data: member } = await supabase
    .from("world_members")
    .select("role")
    .eq("world_id", worldId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = (member as { role?: string } | null)?.role;
  return role === "editor" || role === "viewer" ? role : null;
}

export async function requireWorldAccess(
  supabase: SupabaseClient,
  userId: string,
  worldId: string,
  minimumRole: WorldAccessRole = "viewer",
) {
  const role = await getWorldAccessRole(supabase, userId, worldId);
  return {
    allowed: roleSatisfies(role, minimumRole),
    role,
  };
}
