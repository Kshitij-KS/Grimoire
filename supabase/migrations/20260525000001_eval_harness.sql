-- ============================================================
-- Migration: lm-evaluation-harness integration
-- Creates eval_runs and eval_results tables with RLS
-- ============================================================

-- Evaluation runs table
CREATE TABLE IF NOT EXISTS eval_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name        TEXT NOT NULL,
  tasks             TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  num_samples       INTEGER NOT NULL DEFAULT 50,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evaluation results table (one row per task x metric)
CREATE TABLE IF NOT EXISTS eval_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  task_name     TEXT NOT NULL,
  metric_name   TEXT NOT NULL,
  metric_value  DOUBLE PRECISION NOT NULL,
  stderr        DOUBLE PRECISION,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS eval_runs_user_id_created_at_idx
  ON eval_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS eval_runs_status_idx
  ON eval_runs (status);

CREATE INDEX IF NOT EXISTS eval_results_run_id_idx
  ON eval_results (run_id);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_results ENABLE ROW LEVEL SECURITY;

-- eval_runs: users can only see/manage their own runs
CREATE POLICY "Users can view own eval_runs"
  ON eval_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own eval_runs"
  ON eval_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own eval_runs"
  ON eval_runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own eval_runs"
  ON eval_runs FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can update any run (for webhook callbacks from Python sidecar)
CREATE POLICY "Service role can manage all eval_runs"
  ON eval_runs FOR ALL
  USING (auth.role() = 'service_role');

-- eval_results: users can see results for their own runs
CREATE POLICY "Users can view own eval_results"
  ON eval_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eval_runs
      WHERE eval_runs.id = eval_results.run_id
        AND eval_runs.user_id = auth.uid()
    )
  );

-- Service role can insert/update results (webhook callback)
CREATE POLICY "Service role can manage all eval_results"
  ON eval_results FOR ALL
  USING (auth.role() = 'service_role');
