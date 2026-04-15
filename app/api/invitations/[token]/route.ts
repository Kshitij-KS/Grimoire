export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

/**
 * GET /api/invitations/[token]
 * Validate token, return invitation details + world name preview.
 */
export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data: invitation } = await supabase
    .from("world_invitations")
    .select("*, world:worlds(id, name, genre)")
    .eq("token", params.token)
    .maybeSingle();

  if (!invitation) return jsonError("Invitation not found or expired", 404);
  if (invitation.accepted_at) return jsonError("Invitation already accepted", 410);
  if (new Date(invitation.expires_at) < new Date()) {
    return jsonError("Invitation has expired", 410);
  }

  return Response.json({ invitation });
}

/**
 * POST /api/invitations/[token]
 * Accept invitation: verify token → insert world_members → mark accepted.
 */
export async function POST(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: invitation } = await supabase
    .from("world_invitations")
    .select("*")
    .eq("token", params.token)
    .maybeSingle();

  if (!invitation) return jsonError("Invitation not found", 404);
  if (invitation.accepted_at) return jsonError("Invitation already accepted", 410);
  if (new Date(invitation.expires_at) < new Date()) {
    return jsonError("Invitation has expired", 410);
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("world_members")
    .select("id")
    .eq("world_id", invitation.world_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: memberError } = await supabase
      .from("world_members")
      .insert({
        world_id: invitation.world_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.created_by,
      });

    if (memberError) return jsonError(memberError.message, 500);
  }

  // Mark invitation as accepted
  await supabase
    .from("world_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", params.token);

  return Response.json({ worldId: invitation.world_id });
}
