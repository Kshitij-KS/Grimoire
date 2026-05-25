"use client";

import { useState } from "react";
import { formatRelativeTime } from "@/lib/utils";
import type { EvalRun } from "@/lib/types";
import { SUPPORTED_EVAL_TASKS, EVAL_MODELS } from "@/lib/constants";

interface BenchmarkRunCardProps {
  run: EvalRun;
  isSelected: boolean;
  onSelect: (run: EvalRun) => void;
  onDelete: (runId: string) => void;
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "var(--text-muted)", glyph: "○",  pulse: false },
  running:   { label: "Running",   color: "var(--ai-pulse)",   glyph: "◈",  pulse: true  },
  completed: { label: "Complete",  color: "var(--success)",    glyph: "✦",  pulse: false },
  failed:    { label: "Failed",    color: "var(--danger)",     glyph: "✕",  pulse: false },
} as const;

function getModelLabel(modelId: string): string {
  return EVAL_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

function getTaskLabels(taskIds: string[]): string[] {
  return taskIds.map(
    (id) => SUPPORTED_EVAL_TASKS.find((t) => t.id === id)?.label ?? id,
  );
}

export function BenchmarkRunCard({
  run,
  isSelected,
  onSelect,
  onDelete,
}: BenchmarkRunCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = STATUS_CONFIG[run.status];
  const taskLabels = getTaskLabels(run.tasks);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(run.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(run)}
      className="w-full text-left rounded-xl border p-4 transition-all duration-200 active:scale-[0.98] active:transition-none"
      style={{
        backgroundColor: isSelected ? "color-mix(in srgb, var(--ai-pulse) 8%, var(--surface))" : "var(--surface)",
        borderColor: isSelected ? "var(--ai-pulse)" : "var(--border)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Pulsing status glyph */}
          <span
            className={status.pulse ? "animate-pulse" : ""}
            style={{ color: status.color, fontSize: "16px", lineHeight: 1, flexShrink: 0 }}
          >
            {status.glyph}
          </span>
          <span
            className="truncate text-sm font-semibold"
            style={{ color: "var(--text-main)" }}
          >
            {getModelLabel(run.model_name)}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Status badge */}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
              color: status.color,
            }}
          >
            {status.label}
          </span>

          {/* Delete button (only for non-running) */}
          {run.status !== "running" && (
            <button
              type="button"
              onClick={handleDelete}
              className="ml-1 rounded px-1.5 py-0.5 text-[10px] transition-colors"
              style={{
                color: confirmDelete ? "var(--danger)" : "var(--text-muted)",
                backgroundColor: confirmDelete
                  ? "color-mix(in srgb, var(--danger) 12%, transparent)"
                  : "transparent",
              }}
              title={confirmDelete ? "Click again to confirm deletion" : "Delete run"}
            >
              {confirmDelete ? "Confirm?" : "✕"}
            </button>
          )}
        </div>
      </div>

      {/* Task chips */}
      <div className="mt-2 flex flex-wrap gap-1">
        {taskLabels.map((label) => (
          <span
            key={label}
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={{
              backgroundColor: "var(--surface-raised)",
              color: "var(--text-muted)",
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {run.num_samples} samples/task
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {formatRelativeTime(run.created_at)}
        </span>
      </div>

      {/* Error message */}
      {run.status === "failed" && run.error_message && (
        <p
          className="mt-2 rounded-md px-2 py-1 text-[11px] leading-relaxed"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {run.error_message}
        </p>
      )}
    </button>
  );
}
