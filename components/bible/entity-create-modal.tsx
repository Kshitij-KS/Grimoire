"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Landmark,
  Flag,
  Gem,
  CalendarDays,
  Scale,
  Plus,
  Loader2,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Entity, EntityType } from "@/lib/types";
import { entityTypeValues } from "@/lib/entity-validation";

const TYPE_META: Record<EntityType, { label: string; icon: React.ElementType; color: string }> = {
  character: { label: "Character", icon: BookOpen, color: "var(--accent)" },
  location:  { label: "Location",  icon: Landmark, color: "var(--ai-pulse)" },
  faction:   { label: "Faction",   icon: Flag,     color: "var(--danger)" },
  artifact:  { label: "Artifact",  icon: Gem,      color: "var(--accent-soft)" },
  event:     { label: "Event",     icon: CalendarDays, color: "var(--success)" },
  rule:      { label: "Rule",      icon: Scale,    color: "var(--text-muted)" },
};

interface EntityCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worldId: string;
  onEntityCreated: (entity: Entity) => void;
}

export function EntityCreateModal({
  open,
  onOpenChange,
  worldId,
  onEntityCreated,
}: EntityCreateModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("character");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setType("character");
    setSummary("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, name: name.trim(), type, summary: summary.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create entity");
      onEntityCreated(data.entity as Entity);
      toast.success(`${name} added to the Archive.`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create entity.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="glass-panel-elevated rounded-[32px] border-[var(--border)] p-0 sm:max-w-md">
        {/* Decorative rune corners */}
        <span aria-hidden className="pointer-events-none absolute left-4 top-4 select-none font-heading text-2xl text-[var(--accent)] opacity-15">ᚠ</span>
        <span aria-hidden className="pointer-events-none absolute right-4 top-4 select-none font-heading text-2xl text-[var(--accent)] opacity-15">ᚢ</span>
        <span aria-hidden className="pointer-events-none absolute bottom-4 left-4 select-none font-heading text-2xl text-[var(--accent)] opacity-15">ᚦ</span>
        <span aria-hidden className="pointer-events-none absolute bottom-4 right-4 select-none font-heading text-2xl text-[var(--accent)] opacity-15">ᚨ</span>

        {/* Header */}
        <DialogHeader className="arcane-border rounded-t-[32px] px-7 pb-5 pt-7">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
            <Plus className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <DialogTitle className="font-heading text-2xl text-[var(--text-main)]">Add to the Archive</DialogTitle>
          <DialogDescription className="text-sm text-[var(--text-muted)]">
            Manually inscribe an entity into your world&apos;s memory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-7 pb-7 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Obsidian Throne"
              autoFocus
              className="rounded-[12px]"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {entityTypeValues.map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                const isActive = type === t;
                return (
                  <motion.button
                    key={t}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1.5 rounded-[12px] border px-2 py-3 text-xs transition-all ${
                      isActive
                        ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--text-main)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--accent)_20%,transparent)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    <Icon
                      className="h-4 w-4 transition-colors"
                      style={{ color: isActive ? meta.color : undefined }}
                    />
                    {meta.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
              Summary <span className="normal-case opacity-60">(optional)</span>
            </Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A brief description..."
              rows={3}
              className="resize-none rounded-[12px]"
            />
          </div>

          <Button type="submit" disabled={!name.trim() || submitting} className="w-full">
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add to Archive
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
