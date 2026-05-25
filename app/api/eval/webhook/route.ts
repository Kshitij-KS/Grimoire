export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";


// ── POST /api/eval/webhook ─────────────────────────────────────────────────
// Called by the Python sidecar when an evaluation run completes or fails.
// Uses the Supabase service role key (bypasses RLS) to write results.

const WebhookSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(["completed", "failed"]),
  results: z.array(
    z.object({
      task_name: z.string(),
      metric_name: z.string(),
      metric_value: z.number(),
      stderr: z.number().nullable().optional(),
    }),
  ),
  errorMessage: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  // Validate shared secret to ensure only our sidecar can call this
  const webhookSecret = process.env.EVAL_WEBHOOK_SECRET ?? "";
  if (webhookSecret) {
    const incoming = request.headers.get("x-eval-webhook-secret") ?? "";
    if (incoming !== webhookSecret) {
      return jsonError("Forbidden", 403);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = WebhookSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid webhook payload", 400);
  }

  const { runId, status, results, errorMessage } = parsed.data;

  // Use service role key — sidecar has no user session
  const supabase = createAdminSupabaseClient();


  // Verify the run exists before writing
  const { data: run } = await supabase
    .from("eval_runs")
    .select("id, status")
    .eq("id", runId)
    .single();

  if (!run) {
    return jsonError(`Eval run ${runId} not found`, 404);
  }

  // Don't overwrite a run that's already completed/failed (idempotency guard)
  if (run.status === "completed" || run.status === "failed") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Update the run status
  const { error: updateError } = await supabase
    .from("eval_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    })
    .eq("id", runId);

  if (updateError) {
    console.error("[eval/webhook] Failed to update run status:", updateError);
    return jsonError(updateError.message, 500);
  }

  // Insert result rows if run completed successfully
  if (status === "completed" && results.length > 0) {
    const rows = results.map((r) => ({
      run_id: runId,
      task_name: r.task_name,
      metric_name: r.metric_name,
      metric_value: r.metric_value,
      stderr: r.stderr ?? null,
    }));

    const { error: insertError } = await supabase.from("eval_results").insert(rows);

    if (insertError) {
      console.error("[eval/webhook] Failed to insert eval results:", insertError);
      // Don't fail the whole webhook — run is already marked complete
    }
  }

  return NextResponse.json({ ok: true, runId, status, resultsInserted: results.length });
}
