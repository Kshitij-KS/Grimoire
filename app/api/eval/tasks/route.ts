export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { SUPPORTED_EVAL_TASKS, EVAL_SIDECAR_URL } from "@/lib/constants";
import { requireUser, jsonError } from "@/lib/api";
import type { EvalTask } from "@/lib/types";

// ── GET /api/eval/tasks ────────────────────────────────────────────────────
// Returns the list of supported benchmark tasks.
// Optionally enriched with live data from the sidecar if it's running.

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  // Try to get live task list from sidecar; fall back to static list
  let tasks: EvalTask[] = SUPPORTED_EVAL_TASKS as unknown as EvalTask[];
  let sidecarAvailable = false;

  try {
    const sidecarRes = await fetch(`${EVAL_SIDECAR_URL}/tasks`, {
      signal: AbortSignal.timeout(3_000),
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    if (sidecarRes.ok) {
      const json = (await sidecarRes.json()) as { tasks: EvalTask[] };
      if (Array.isArray(json.tasks) && json.tasks.length > 0) {
        tasks = json.tasks;
        sidecarAvailable = true;
      }
    }
  } catch {
    // Sidecar not running — use static list, which is fine
  }

  return NextResponse.json({ tasks, sidecarAvailable });

}
