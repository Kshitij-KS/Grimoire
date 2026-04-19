"use client";

import { useState, useMemo } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, GitMerge, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Entity } from "@/lib/types";

interface EntityMergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntity: Entity;
  allEntities: Entity[];
  onMergeComplete: (sourceId: string, updatedTarget: Entity) => void;
}

export function EntityMergeModal({
  open,
  onOpenChange,
  sourceEntity,
  allEntities,
  onMergeComplete,
}: EntityMergeModalProps) {
  const [search, setSearch] = useState("");
  const [targetEntity, setTargetEntity] = useState<Entity | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [merging, setMerging] = useState(false);

  const required = `merge ${sourceEntity.name}`;
  const canConfirm = confirmText.toLowerCase() === required.toLowerCase() && targetEntity !== null;

  const candidates = useMemo(
    () =>
      allEntities
        .filter((e) => e.id !== sourceEntity.id)
        .filter((e) =>
          search.trim()
            ? e.name.toLowerCase().includes(search.toLowerCase())
            : true,
        )
        .slice(0, 8),
    [allEntities, sourceEntity.id, search],
  );

  const reset = () => {
    setSearch("");
    setTargetEntity(null);
    setConfirmText("");
  };

  const handleMerge = async () => {
    if (!canConfirm || merging || !targetEntity) return;
    setMerging(true);
    try {
      const res = await fetch(`/api/entities/${sourceEntity.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEntityId: targetEntity.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Merge failed");
      onMergeComplete(sourceEntity.id, data.target as Entity);
      toast.success(`${sourceEntity.name} absorbed into ${targetEntity.name}.`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Merge failed.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="glass-panel-elevated rounded-[32px] border-[var(--border)] p-0 sm:max-w-lg">
        <span aria-hidden className="pointer-events-none absolute left-4 top-4 select-none font-heading text-2xl text-[var(--danger)] opacity-15">ᚠ</span>
        <span aria-hidden className="pointer-events-none absolute right-4 top-4 select-none font-heading text-2xl text-[var(--danger)] opacity-15">ᚢ</span>

        <DialogHeader className="px-7 pb-4 pt-7">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]">
            <GitMerge className="h-5 w-5 text-[var(--danger)]" />
          </div>
          <DialogTitle className="font-heading text-2xl text-[var(--text-main)]">Merge Entity</DialogTitle>
          <DialogDescription className="text-sm text-[var(--text-muted)]">
            Absorb <span className="text-[var(--text-main)]">{sourceEntity.name}</span> into another entity.
            All lore references and relationships will transfer to the target.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-7 pb-7">
          {/* Target search */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Absorb into</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setTargetEntity(null); }}
                placeholder="Search entities..."
                className="pl-9 rounded-[12px]"
              />
            </div>

            {candidates.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)]">
                {candidates.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setTargetEntity(e); setSearch(e.name); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-raised)] ${
                      targetEntity?.id === e.id ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]" : "text-[var(--text-main)]"
                    }`}
                  >
                    <span>{e.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] capitalize">{e.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Merge preview */}
          {targetEntity && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-main)]">{sourceEntity.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{sourceEntity.mention_count ?? 0} mentions</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-sm font-medium text-[var(--text-main)]">{targetEntity.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{targetEntity.mention_count ?? 0} mentions</p>
              </div>
            </motion.div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2.5 rounded-[12px] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              <span className="text-[var(--danger)]">{sourceEntity.name} will be permanently deleted.</span>{" "}
              This cannot be undone.
            </p>
          </div>

          {/* Confirm input */}
          <div className="space-y-1.5">
            <p className="text-xs text-[var(--text-muted)]">
              Type <span className="font-mono text-[var(--text-main)]">{required}</span> to confirm
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={required}
              className="rounded-[12px] font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleMerge}
            disabled={!canConfirm || merging}
            variant="danger"
            className="w-full"
          >
            {merging ? (
              <LoadingSpinner className="mr-2 h-4 w-4" />
            ) : (
              <GitMerge className="mr-2 h-4 w-4" />
            )}
            Merge and Delete {sourceEntity.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
