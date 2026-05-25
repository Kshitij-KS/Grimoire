export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import type { EvalRunWithResults } from "@/lib/types";

// ── GET /api/eval/runs/[id] ────────────────────────────────────────────────
// Returns a single eval run with its results joined.

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { user, supabase, error } = await requireUser();
  if (error) return error;

  const { data: run, error: dbError } = await supabase
    .from("eval_runs")
    .select(`
      *,
      eval_results (*)
    `)
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .single();

  if (dbError || !run) {
    return jsonError("Eval run not found", 404);
  }

  return NextResponse.json({ run: run as EvalRunWithResults });
}

// ── DELETE /api/eval/runs/[id] ─────────────────────────────────────────────
// Deletes an eval run and its results (CASCADE handles eval_results).

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { user, supabase, error } = await requireUser();
  if (error) return error;

  // Verify ownership before deleting
  const { data: existing } = await supabase
    .from("eval_runs")
    .select("id, status")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .single();

  if (!existing) {
    return jsonError("Eval run not found", 404);
  }

  if (existing.status === "running") {
    return jsonError("Cannot delete a running eval. Wait for it to complete or fail.", 409);
  }

  const { error: deleteError } = await supabase
    .from("eval_runs")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user!.id);

  if (deleteError) {
    return jsonError(deleteError.message, 500);
  }

  return NextResponse.json({ success: true });
}
