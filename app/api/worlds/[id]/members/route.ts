export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser, jsonError, zodErrorResponse } from "@/lib/api";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["editor", "viewer"]),
});

/**
 * GET /api/worlds/[id]/members
 * Returns members + pending invitations. World owner only.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const worldId = params.id;

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  const [membersResult, invitationsResult] = await Promise.all([
    supabase
      .from("world_members")
      .select("*, profile:profiles(id, username, display_name)")
      .eq("world_id", worldId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("world_invitations")
      .select("*")
      .eq("world_id", worldId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return Response.json({
    members: membersResult.data ?? [],
    invitations: invitationsResult.data ?? [],
  });
}

/**
 * POST /api/worlds/[id]/members
 * Send an invitation: { email, role } → creates world_invitations row.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const worldId = params.id;

  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id, name")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { email, role } = parsed.data;

  // Check if already a member via email
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", email)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await supabase
      .from("world_members")
      .select("id")
      .eq("world_id", worldId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (existingMember) return jsonError("This user is already a member", 409);
  }

  const { data: invitation, error } = await supabase
    .from("world_invitations")
    .insert({
      world_id: worldId,
      invited_email: email,
      role,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  return Response.json({ invitation }, { status: 201 });
}
