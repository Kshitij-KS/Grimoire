"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Entity, EntityRelationship } from "@/lib/types";

interface ForgeRelationshipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worldId: string;
  sourceEntity: Entity | null;
  targetEntity: Entity | null;
  onSuccess: (rel: EntityRelationship) => void;
}

export function ForgeRelationshipModal({
  open,
  onOpenChange,
  worldId,
  sourceEntity,
  targetEntity,
  onSuccess,
}: ForgeRelationshipModalProps) {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setTimeout(() => {
        setLabel("");
        setError(null);
      }, 200);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceEntity || !targetEntity || !label.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          sourceEntityId: sourceEntity.id,
          targetEntityId: targetEntity.id,
          label: label.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to forge relationship");

      // Merge entity data back into the returned relationship for immediate UI rendering
      const newRel = {
        ...data.relationship,
        source_entity: sourceEntity,
        target_entity: targetEntity,
      };

      onSuccess(newRel);
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && sourceEntity && targetEntity && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[rgba(13,11,8,0.8)] backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-panel w-full max-w-md overflow-hidden rounded-[32px] border-[var(--accent)]/30 bg-[var(--surface)] shadow-arcane-glow"
            >
              <div className="flex items-center justify-between border-b border-[var(--accent)]/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Link className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-heading text-2xl text-[var(--accent)]">Forge Link</h2>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="rounded-xl p-2 text-secondary transition hover:bg-[var(--accent)]/10 hover:text-[var(--text-main)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="mb-6 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/20 p-4 border border-[var(--border)]/50">
                  <span className="font-heading text-lg text-[var(--text-main)]">{sourceEntity.name}</span>
                  <div className="flex flex-col items-center">
                    <div className="h-4 w-[2px] bg-[var(--accent)]/30" />
                    <span className="my-1 text-xs uppercase tracking-widest text-[var(--accent)]">is</span>
                    <div className="h-4 w-[2px] bg-[var(--accent)]/30" />
                  </div>
                  <span className="font-heading text-lg text-[var(--text-main)]">{targetEntity.name}</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-widest text-secondary">
                      Relationship Label (e.g. "Sworn Enemy", "Secretly loves")
                    </label>
                    <input
                      autoFocus
                      required
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-black/40 px-4 py-3 text-sm text-[var(--text-main)] outline-none transition-all focus:border-[var(--accent)] focus:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]"
                      placeholder="e.g. Rules over"
                    />
                  </div>
                  {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="accent"
                    disabled={loading || !label.trim()}
                    className="gap-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                    Forge Connection
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
