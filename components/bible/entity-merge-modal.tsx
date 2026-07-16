"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GitMerge, X, AlertTriangle, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { Entity } from "@/lib/types";

interface EntityMergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worldId: string;
  primaryEntity: Entity;
  allEntities: Entity[];
  onMerged: (deletedId: string) => void;
}

export function EntityMergeModal({
  open,
  onOpenChange,
  worldId,
  primaryEntity,
  allEntities,
  onMerged,
}: EntityMergeModalProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [merging, setMerging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const candidates = allEntities.filter(
    (e) => e.id !== primaryEntity.id && e.type === primaryEntity.type
  );

  const selectedEntity = candidates.find((e) => e.id === selectedId);

  const handleClose = () => {
    if (merging) return;
    onOpenChange(false);
    setTimeout(() => {
      setSelectedId("");
      setConfirmed(false);
    }, 250);
  };

  const handleMerge = async () => {
    if (!selectedId || !confirmed || merging) return;
    setMerging(true);
    try {
      const res = await fetch("/api/entities/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          primaryEntityId: primaryEntity.id,
          secondaryEntityId: selectedId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Merge failed. The oracle resisted.");
        return;
      }
      toast.success(
        `"${data.secondaryName}" has been absorbed into "${data.primaryName}".`,
        { duration: 4000 }
      );
      onMerged(selectedId);
      onOpenChange(false);
    } catch {
      toast.error("Merge failed — the ritual was interrupted.");
    } finally {
      setMerging(false);
    }
  };

  // Portal to document.body so `position: fixed` is relative to the viewport,
  // not the constellation's transformed/overflow-hidden container (which was
  // clipping this modal to the canvas area).
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="glass-panel-elevated w-full max-w-md overflow-hidden rounded-[24px] shadow-arcane"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]">
                    <GitMerge className="h-4 w-4 text-[var(--danger)]" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl text-[var(--text-main)]">Merge Entity</h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Absorb one entity into another permanently
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)] hover:text-[var(--text-main)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-6">
                {/* Primary Entity */}
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)] font-bold">
                    Primary (survives)
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_6%,transparent)] px-4 py-3">
                    <Check className="h-4 w-4 shrink-0 text-[var(--success)]" />
                    <div>
                      <p className="font-medium text-sm text-[var(--text-main)]">{primaryEntity.name}</p>
                      <p className="text-xs text-[var(--text-muted)] capitalize">{primaryEntity.type}</p>
                    </div>
                  </div>
                </div>

                {/* Secondary Entity Picker */}
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)] font-bold">
                    Absorbed into Primary (deleted)
                  </label>
                  {candidates.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] italic">
                      No other {primaryEntity.type} entities to merge with.
                    </p>
                  ) : (
                    <select
                      value={selectedId}
                      onChange={(e) => { setSelectedId(e.target.value); setConfirmed(false); }}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--border-focus)] transition-colors"
                    >
                      <option value="">— Select entity to absorb —</option>
                      {candidates.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Confirmation */}
                {selectedId && selectedEntity && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] px-4 py-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
                      <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                        <span className="text-[var(--danger)] font-medium">{selectedEntity.name}</span>{" "}
                        will be permanently deleted. All its relationships and lore chunk references
                        will be remapped to{" "}
                        <span className="text-[var(--text-main)] font-medium">{primaryEntity.name}</span>.
                        This cannot be undone.
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => setConfirmed((v) => !v)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all"
                        style={confirmed ? {
                          borderColor: "var(--danger)",
                          background: "color-mix(in srgb, var(--danger) 20%, transparent)",
                        } : { borderColor: "var(--border)" }}
                      >
                        {confirmed && <Check className="h-3 w-3 text-[var(--danger)]" />}
                      </div>
                      <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors">
                        I understand this action is irreversible
                      </span>
                    </label>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                <button
                  onClick={handleClose}
                  disabled={merging}
                  className="rounded-xl px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMerge}
                  disabled={!selectedId || !confirmed || merging}
                  className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-5 py-2 text-sm font-medium text-[var(--danger)] transition-all hover:bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] active:scale-[0.97] active:transition-none disabled:opacity-30"
                >
                  {merging ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GitMerge className="h-3.5 w-3.5" />
                  )}
                  {merging ? "Merging…" : "Execute Merge"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
