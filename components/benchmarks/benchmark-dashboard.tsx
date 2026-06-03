"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { TaskSelector } from "./task-selector";
import { BenchmarkRunCard } from "./benchmark-run-card";
import { BenchmarkResultsPanel } from "./benchmark-results-panel";
import { EVAL_MODELS, EVAL_DEFAULT_SAMPLES, DAILY_LIMITS } from "@/lib/constants";
import { trackRateLimitHit } from "@/lib/analytics";
import type { EvalRun, EvalRunWithResults } from "@/lib/types";
import type { EvalTaskId, EvalModelId } from "@/lib/constants";

interface BenchmarkDashboardProps {
  initialRuns: EvalRun[];
}

const MAX_EVAL_RUNS_PER_DAY = DAILY_LIMITS.eval_run;

export function BenchmarkDashboard({ initialRuns }: BenchmarkDashboardProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [runs, setRuns] = useState<EvalRun[]>(initialRuns);
  const [selectedModel, setSelectedModel] = useState<EvalModelId>(EVAL_MODELS[0].id);
  const [selectedTasks, setSelectedTasks] = useState<EvalTaskId[]>([
    "arc_easy" as EvalTaskId,
    "hellaswag" as EvalTaskId,
  ]);
  const [numSamples, setNumSamples] = useState(EVAL_DEFAULT_SAMPLES);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState<EvalRunWithResults | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sidecarOffline, setSidecarOffline] = useState(false);

  // ── Polling for running runs ──────────────────────────────────────────────
  const hasRunningRun = runs.some((r) => r.status === "running" || r.status === "pending");

  const refreshRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/eval/runs");
      if (!res.ok) return;
      const json = (await res.json()) as { runs: EvalRun[] };
      setRuns(json.runs);
      // If selected run is now complete, refresh its details
      if (selectedRunId) {
        const selected = json.runs.find((r) => r.id === selectedRunId);
        if (selected?.status === "completed" && selectedRunDetails?.status !== "completed") {
          fetchRunDetails(selectedRunId);
        }
      }
    } catch {
      // Non-fatal — polling failure
    }
  }, [selectedRunId, selectedRunDetails]);

  // Poll every 5 seconds while a run is in progress
  useEffect(() => {
    if (!hasRunningRun) return;
    const interval = setInterval(refreshRuns, 5000);
    return () => clearInterval(interval);
  }, [hasRunningRun, refreshRuns]);

  // ── Fetch run details ─────────────────────────────────────────────────────
  const fetchRunDetails = async (runId: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/eval/runs/${runId}`);
      if (!res.ok) throw new Error("Failed to fetch run details");
      const json = (await res.json()) as { run: EvalRunWithResults };
      setSelectedRunDetails(json.run);
    } catch {
      toast.error("Failed to load results");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectRun = (run: EvalRun) => {
    setSelectedRunId(run.id);
    if (run.status === "completed") {
      fetchRunDetails(run.id);
    } else {
      setSelectedRunDetails(null);
    }
  };

  // ── Create new run ────────────────────────────────────────────────────────
  const handleStartEval = async () => {
    if (selectedTasks.length === 0) {
      toast.error("Select at least one benchmark task");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/eval/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelName: selectedModel,
            tasks: selectedTasks,
            numSamples,
          }),
        });

        const json = await res.json();

        if (res.status === 503) {
          setSidecarOffline(true);
          toast.error("Evaluation service is offline. Run: npm run eval:service");
          return;
        }

        if (res.status === 429) {
          trackRateLimitHit("eval_run", MAX_EVAL_RUNS_PER_DAY, MAX_EVAL_RUNS_PER_DAY);
          toast.error(
            `The spellwork needs to rest. You've used ${MAX_EVAL_RUNS_PER_DAY}/${MAX_EVAL_RUNS_PER_DAY} evaluation runs today.`,
          );
          return;
        }

        if (!res.ok) {
          toast.error(json.error ?? "Failed to start evaluation");
          return;
        }

        setSidecarOffline(false);
        toast.success("Evaluation begun — the Oracle reads the runes...");
        setRuns((prev) => [json.run as EvalRun, ...prev]);
        setSelectedRunId(json.run.id);
        setSelectedRunDetails(null);
      } catch {
        toast.error("Network error — check your connection");
      }
    });
  };

  // ── Delete run ────────────────────────────────────────────────────────────
  const handleDeleteRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/eval/runs/${runId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to delete run");
        return;
      }
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setSelectedRunDetails(null);
      }
      toast.success("Run deleted");
    } catch {
      toast.error("Failed to delete run");
    }
  };

  const todayRunCount = runs.filter((r) => {
    const created = new Date(r.created_at);
    const today = new Date();
    return (
      created.getFullYear() === today.getFullYear() &&
      created.getMonth() === today.getMonth() &&
      created.getDate() === today.getDate()
    );
  }).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ color: "var(--text-main)" }}>
      {/* Page header */}
      <div className="mb-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⚗️</span>
          <h1 className="font-heading text-3xl font-bold" style={{ color: "var(--accent)" }}>
            The Crucible
          </h1>
        </div>
        <p className="text-base" style={{ color: "var(--text-muted)" }}>
          Benchmark your AI models against standard academic evaluation tasks. Measure reasoning,
          common sense, and knowledge — then choose the right model for your world.
        </p>
      </div>

      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left column: Launcher + Results ───────────────────────────── */}
        <div className="space-y-6">
          {/* Sidecar offline notice */}
          {sidecarOffline && (
            <div
              className="flex items-start gap-3 rounded-xl border p-4 text-sm"
              style={{
                backgroundColor: "color-mix(in srgb, var(--danger) 8%, var(--surface))",
                borderColor: "var(--danger)",
                color: "var(--danger)",
              }}
            >
              <span className="text-lg">⚠</span>
              <div>
                <p className="font-semibold">Evaluation service is not running</p>
                <p className="mt-1 text-xs opacity-80">
                  The Python sidecar must be running to start evaluations. Open a terminal and run:
                </p>
                <code
                  className="mt-2 block rounded px-2 py-1 text-xs font-mono"
                  style={{ backgroundColor: "color-mix(in srgb, var(--danger) 15%, transparent)" }}
                >
                  npm run eval:service
                </code>
              </div>
            </div>
          )}

          {/* ── New Evaluation Card ────────────────────────────────────── */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="mb-5 flex items-center gap-2">
              <span className="text-base">✦</span>
              <h2 className="font-heading text-lg font-semibold" style={{ color: "var(--accent)" }}>
                New Evaluation
              </h2>
              <span
                className="ml-auto text-xs"
                style={{ color: todayRunCount >= MAX_EVAL_RUNS_PER_DAY ? "var(--danger)" : "var(--text-muted)" }}
              >
                {todayRunCount}/{MAX_EVAL_RUNS_PER_DAY} today
              </span>
            </div>

            <div className="space-y-5">
              {/* Model selector */}
              <div>
                <label
                  className="mb-2 block text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  Model
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EVAL_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModel(model.id)}
                      className="rounded-lg border p-3 text-left transition-all duration-150 active:scale-[0.98] active:transition-none"
                      style={{
                        backgroundColor:
                          selectedModel === model.id
                            ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                            : "var(--surface-raised)",
                        borderColor:
                          selectedModel === model.id ? "var(--accent)" : "var(--border)",
                      }}
                    >
                      <p
                        className="text-sm font-semibold"
                        style={{
                          color:
                            selectedModel === model.id ? "var(--accent-soft)" : "var(--text-main)",
                        }}
                      >
                        {model.label}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        {model.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Task selector */}
              <div>
                <label
                  className="mb-3 block text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  Benchmark Tasks
                </label>
                <TaskSelector
                  selected={selectedTasks}
                  onChange={setSelectedTasks}
                  disabled={isPending}
                />
              </div>

              {/* Sample count slider */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Samples per Task
                  </label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                    {numSamples}
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Samples per task"
                  min={5}
                  max={500}
                  step={5}
                  value={numSamples}
                  onChange={(e) => setNumSamples(parseInt(e.target.value, 10))}
                  disabled={isPending}
                  className="w-full accent-[var(--accent)]"
                  style={{ accentColor: "var(--accent)" }}
                />
                <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span>5 (fast)</span>
                  <span>500 (thorough)</span>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="button"
                onClick={handleStartEval}
                disabled={isPending || selectedTasks.length === 0 || todayRunCount >= MAX_EVAL_RUNS_PER_DAY}
                className="w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98] active:transition-none disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--bg)",
                }}
              >
                {isPending ? "Inscribing runes..." : "⚗ Begin Evaluation"}
              </button>
            </div>
          </div>

          {/* ── Results Panel ──────────────────────────────────────────── */}
          {selectedRunId && (
            <div
              className="rounded-xl border p-6"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2 className="font-heading text-lg font-semibold mb-4" style={{ color: "var(--accent)" }}>
                ✦ Results
              </h2>

              {loadingDetails && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <span className="animate-spin text-xl" style={{ color: "var(--ai-pulse)" }}>◈</span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Reading the oracle&apos;s findings...
                  </span>
                </div>
              )}

              {!loadingDetails && selectedRunDetails?.status === "completed" && (
                <BenchmarkResultsPanel run={selectedRunDetails} />
              )}

              {!loadingDetails && !selectedRunDetails && (
                <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  {runs.find((r) => r.id === selectedRunId)?.status === "running"
                    ? "Evaluation in progress — results will appear when complete"
                    : "Select a completed run to view results"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right column: Run history ──────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Run History
            </h2>
            {hasRunningRun && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ai-pulse)" }}>
                <span className="animate-pulse">◈</span> Live
              </span>
            )}
          </div>

          {runs.length === 0 ? (
            <div
              className="rounded-xl border p-6 text-center"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No evaluations yet. Begin your first to see the runes align.
              </p>
            </div>
          ) : (
            runs.map((run) => (
              <BenchmarkRunCard
                key={run.id}
                run={run}
                isSelected={selectedRunId === run.id}
                onSelect={handleSelectRun}
                onDelete={handleDeleteRun}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
