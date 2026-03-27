export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/api";
import { inngest } from "@/lib/inngest-client";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId");

  if (!worldId) return Response.json({ error: "Missing worldId" }, { status: 400 });

  const { data: jobs } = await supabase
    .from("failed_jobs")
    .select("*")
    .eq("world_id", worldId)
    .eq("user_id", user.id)
    .neq("status", "resolved")
    .order("created_at", { ascending: false });

  return Response.json({ jobs: jobs ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;
  const body = await request.json();

  if (body.action === "retry") {
    const jobId = body.jobId;
    if (!jobId) return Response.json({ error: "Missing jobId" }, { status: 400 });

    const { data: job } = await supabase
      .from("failed_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    if (job.retry_count >= job.max_retries) {
      return Response.json({ error: "Max retries exceeded" }, { status: 400 });
    }

    // Update status to retrying
    await supabase
      .from("failed_jobs")
      .update({ status: "retrying", retry_count: job.retry_count + 1 })
      .eq("id", jobId);

    // Re-trigger via Inngest
    try {
      await inngest.send({
        name: job.event_name,
        data: job.payload,
      });
    } catch {
      // If Inngest is unavailable, mark as failed again
      await supabase
        .from("failed_jobs")
        .update({ status: "failed" })
        .eq("id", jobId);

      return Response.json({ error: "Failed to re-queue job" }, { status: 500 });
    }

    return Response.json({ success: true, status: "retrying" });
  }

  if (body.action === "resolve") {
    const jobId = body.jobId;
    if (!jobId) return Response.json({ error: "Missing jobId" }, { status: 400 });

    await supabase
      .from("failed_jobs")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", user.id);

    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
