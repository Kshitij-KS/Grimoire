"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface InlineFlag {
  id: string;
  flagged_text: string;
  contradiction: string;
  existing_reference: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
}

interface ConsistencyInlinePopoverProps {
  flags: InlineFlag[];
  loading: boolean;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

const SEVERITY_CONFIG = {
  high:   { color: "var(--danger)",      bg: "color-mix(in srgb, var(--danger) 10%, transparent)",      label: "Critical" },
  medium: { color: "var(--accent)",      bg: "color-mix(in srgb, var(--accent) 10%, transparent)",      label: "Warning"  },
  low:    { color: "var(--text-muted)",  bg: "color-mix(in srgb, var(--text-muted) 8%, transparent)",   label: "Minor"    },
} as const;

export function ConsistencyInlinePopover({
  flags,
  loading,
  onDismiss,
  onDismissAll,
}: ConsistencyInlinePopoverProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeFlags = flags.filter((f) => !f.resolved);

  return (
    <AnimatePresence>
      {(loading || activeFlags.length > 0) && (
        <motion.div
          key="fracture-lens"
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="mt-3 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ai-pulse)]" />
            ) : activeFlags.some((f) => f.severity === "high") ? (
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--danger)]" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
            )}
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {loading
                ? "FractureLens scanning…"
                : activeFlags.length === 0
                ? "No contradictions detected"
                : `${activeFlags.length} contradiction${activeFlags.length !== 1 ? "s" : ""} found`}
            </span>
            {!loading && activeFlags.length > 0 && (
              <button
                onClick={onDismissAll}
                className="ml-auto text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                dismiss all
              </button>
            )}
          </div>

          {/* Flags list */}
          {!loading && activeFlags.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {activeFlags.map((flag) => {
                const cfg = SEVERITY_CONFIG[flag.severity];
                const isExpanded = expandedId === flag.id;
                return (
                  <div key={flag.id} className="px-4 py-3">
                    {/* Flag header row */}
                    <div className="flex items-start gap-2.5">
                      <div
                        className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[var(--text-main)] line-clamp-1">
                          &ldquo;{flag.flagged_text}&rdquo;
                        </p>
                        {!isExpanded && (
                          <p className="mt-0.5 text-[11px] text-[var(--text-muted)] line-clamp-1">
                            {flag.contradiction}
                          </p>
                        )}
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : flag.id)}
                          className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() => onDismiss(flag.id)}
                          className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-black/20 p-3">
                            <div>
                              <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Contradiction</p>
                              <p className="text-xs text-[var(--text-main)] leading-relaxed">{flag.contradiction}</p>
                            </div>
                            {flag.existing_reference && (
                              <div>
                                <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Archive Reference</p>
                                <p className="text-xs text-[var(--text-muted)] leading-relaxed italic">&ldquo;{flag.existing_reference}&rdquo;</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
