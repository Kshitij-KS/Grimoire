"use client";

import type { EvalRunWithResults, EvalResult } from "@/lib/types";
import { SUPPORTED_EVAL_TASKS, EVAL_MODELS } from "@/lib/constants";

interface BenchmarkResultsPanelProps {
  run: EvalRunWithResults;
}

function getModelLabel(modelId: string): string {
  return EVAL_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

function getTaskLabel(taskId: string): string {
  return SUPPORTED_EVAL_TASKS.find((t) => t.id === taskId)?.label ?? taskId;
}

/** Returns the primary accuracy metric for a task's results. */
function getPrimaryAccuracy(results: EvalResult[], taskName: string): EvalResult | null {
  const taskResults = results.filter((r) => r.task_name === taskName);
  // Prefer normalized accuracy, then plain accuracy
  return (
    taskResults.find((r) => r.metric_name === "acc_norm") ??
    taskResults.find((r) => r.metric_name === "acc") ??
    taskResults[0] ??
    null
  );
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function BenchmarkResultsPanel({ run }: BenchmarkResultsPanelProps) {
  const taskResults = run.tasks.map((taskId) => {
    const primary = getPrimaryAccuracy(run.eval_results, taskId);
    const allMetrics = run.eval_results.filter((r) => r.task_name === taskId);
    return { taskId, taskLabel: getTaskLabel(taskId), primary, allMetrics };
  });

  const avgAccuracy =
    taskResults.length > 0 && taskResults.some((t) => t.primary !== null)
      ? taskResults.reduce((sum, t) => sum + (t.primary?.metric_value ?? 0), 0) /
        taskResults.filter((t) => t.primary !== null).length
      : null;

  return (
    <div className="space-y-6">
      {/* Run metadata header */}
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg" style={{ color: "var(--accent)" }}>
              {getModelLabel(run.model_name)}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              {run.num_samples} samples/task · Duration:{" "}
              {formatDuration(run.started_at, run.completed_at)}
            </p>
          </div>

          {avgAccuracy !== null && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Avg. Accuracy
              </p>
              <p
                className="font-heading text-3xl font-bold"
                style={{ color: "var(--accent)" }}
              >
                {(avgAccuracy * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Per-task bars */}
      <div className="space-y-4">
        <p
          className="chapter-label text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          — Results by Task —
        </p>

        {taskResults.map(({ taskId, taskLabel, primary, allMetrics }) => {
          const pct = primary ? primary.metric_value * 100 : null;
          const stderr = primary?.stderr ? primary.stderr * 100 : null;

          return (
            <div key={taskId} className="space-y-1.5">
              {/* Task label + score */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                  {taskLabel}
                </span>
                <div className="flex items-center gap-2">
                  {stderr !== null && (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      ±{stderr.toFixed(1)}%
                    </span>
                  )}
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: pct !== null ? "var(--accent-soft)" : "var(--text-muted)" }}
                  >
                    {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>

              {/* Accuracy bar — styled as "rune slots" */}
              <div
                className="relative h-3 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--surface-raised)" }}
              >
                {pct !== null && (
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: `linear-gradient(90deg, var(--ai-pulse) 0%, var(--accent) 100%)`,
                    }}
                  />
                )}
              </div>

              {/* All metrics breakdown (collapsed by default) */}
              {allMetrics.length > 1 && (
                <details className="mt-1">
                  <summary
                    className="cursor-pointer text-[11px] select-none"
                    style={{ color: "var(--text-muted)" }}
                  >
                    All metrics ({allMetrics.length})
                  </summary>
                  <div className="mt-1.5 rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
                    <table className="w-full text-[11px]">
                      <tbody>
                        {allMetrics.map((m) => (
                          <tr key={`${m.task_name}-${m.metric_name}`}>
                            <td style={{ color: "var(--text-muted)", paddingRight: "1rem" }}>
                              {m.metric_name}
                            </td>
                            <td
                              className="text-right font-mono"
                              style={{ color: "var(--text-main)" }}
                            >
                              {(m.metric_value * 100).toFixed(2)}%
                            </td>
                            {m.stderr !== null && (
                              <td
                                className="text-right font-mono"
                                style={{ color: "var(--text-muted)" }}
                              >
                                ±{(m.stderr * 100).toFixed(2)}%
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Lore-flavored footer note */}
      <p
        className="rounded-lg border p-3 text-xs italic leading-relaxed"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-muted)",
          backgroundColor: "var(--surface)",
        }}
      >
        ✦ These metrics reflect performance on {run.num_samples} sampled questions per task.
        Results may vary from full-dataset scores. Higher accuracy does not always mean better
        roleplay or creative fidelity.
      </p>
    </div>
  );
}
