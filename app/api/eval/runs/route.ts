export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError, jsonRateLimited, zodErrorResponse } from "@/lib/api";
import { checkAndIncrement } from "@/lib/rate-limit";
import {
  SUPPORTED_EVAL_TASKS,
  EVAL_MODELS,
  EVAL_DEFAULT_SAMPLES,
  EVAL_SIDECAR_URL,
} from "@/lib/constants";
import type { EvalRun } from "@/lib/types";

const CreateRunSchema = z.object({
  modelName: z.enum(EVAL_MODELS.map((m) => m.id) as [string, ...string[]]),
  tasks: z
    .array(z.enum(SUPPORTED_EVAL_TASKS.map((t) => t.id) as [string, ...string[]]))
    .min(1, "Select at least one task")
    .max(8, "Maximum 8 tasks per run"),
  numSamples: z.number().int().min(5).max(500).default(EVAL_DEFAULT_SAMPLES),
});

// ── GET /api/eval/runs ─────────────────────────────────────────────────────
// Returns paginated list of eval runs for the authenticated user.

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const pageSize = 20;

  const { data: runs, error: dbError } = await supabase
    .from("eval_runs")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (dbError) {
    return jsonError(dbError.message, 500);
  }

  return NextResponse.json({ runs: runs as EvalRun[], page, pageSize });
}

// ── POST /api/eval/runs ────────────────────────────────────────────────────
// Creates a new eval run, inserts it into Supabase, and fires off the sidecar.

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = CreateRunSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { modelName, tasks, numSamples } = parsed.data;

  // Rate limit: 3 eval runs per day
  const rateLimitResult = await checkAndIncrement(supabase!, user!.id, "eval_run", 3);
  if (!rateLimitResult.allowed) {
    return jsonRateLimited("eval_run", 3);
  }

  // Insert the run record with "pending" status
  const { data: run, error: insertError } = await supabase
    .from("eval_runs")
    .insert({
      user_id: user!.id,
      model_name: modelName,
      tasks,
      num_samples: numSamples,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !run) {
    return jsonError(insertError?.message ?? "Failed to create eval run", 500);
  }

  // Kick off the Python sidecar (non-blocking — we don't await deeply)
  const sidecarSecret = process.env.EVAL_SIDECAR_SECRET ?? "";
  try {
    const sidecarRes = await fetch(`${EVAL_SIDECAR_URL}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sidecarSecret ? { "x-sidecar-secret": sidecarSecret } : {}),
      },
      body: JSON.stringify({
        runId: run.id,
        modelName,
        tasks,
        numSamples,
      }),
      // Short timeout — sidecar should respond immediately (it's non-blocking)
      signal: AbortSignal.timeout(10_000),
    });

    if (!sidecarRes.ok) {
      const detail = await sidecarRes.text().catch(() => "unknown error");
      // Mark run as failed if sidecar rejected it
      await supabase
        .from("eval_runs")
        .update({ status: "failed", error_message: `Sidecar error: ${detail}` })
        .eq("id", run.id);
      return jsonError(`Evaluation service unavailable: ${detail}`, 503);
    }

    // Update to "running" status
    await supabase
      .from("eval_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", run.id);
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : "Could not reach evaluation service";
    await supabase
      .from("eval_runs")
      .update({ status: "failed", error_message: msg })
      .eq("id", run.id);
    return jsonError(
      "The lm-eval sidecar is not running. Start it with: npm run eval:service",
      503,
    );
  }

  return NextResponse.json({ run: { ...run, status: "running" } }, { status: 201 });
}
