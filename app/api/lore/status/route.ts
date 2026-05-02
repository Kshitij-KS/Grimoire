export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/api";
import { requireWorldAccess } from "@/lib/world-access";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");

  if (!entryId) return Response.json({ error: "Missing entryId" }, { status: 400 });

  const { data: entry } = await supabase
    .from("lore_entries")
    .select("id, world_id, processing_status, inngest_event_id")
    .eq("id", entryId)
    .single();

  if (!entry) return Response.json({ error: "Entry not found" }, { status: 404 });
  const access = await requireWorldAccess(supabase, auth.user.id, entry.world_id, "viewer");
  if (!access.allowed) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

  return Response.json({
    entryId: entry.id,
    status: entry.processing_status,
    eventId: entry.inngest_event_id,
  });
}
