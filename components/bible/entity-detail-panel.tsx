"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, UserPlus, X, Edit2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Entity, EntityType } from "@/lib/types";

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "faction", label: "Faction" },
  { value: "artifact", label: "Artifact" },
  { value: "event", label: "Event" },
  { value: "rule", label: "Rule" },
];

export function EntityDetailPanel({
  entity,
  onClose,
  canCreateSoul,
  onCreateSoul,
  onUpdate,
  onDelete,
  isReadonly,
}: {
  entity: Entity | null;
  onClose: () => void;
  canCreateSoul: boolean;
  onCreateSoul?: (name: string) => void;
  onUpdate?: (updated: Entity) => void;
  onDelete?: (id: string) => void;
  isReadonly?: boolean;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<EntityType>("character");
  const [editSummary, setEditSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (entity) {
      setEditName(entity.name);
      setEditType(entity.type);
      setEditSummary(entity.summary ?? "");
      setIsEditing(false);
    }
  }, [entity]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const copyChunk = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSave = async () => {
    if (!entity || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/entities/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          type: editType,
          summary: editSummary.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save entity");
      const { entity: updated } = await res.json();
      if (onUpdate) onUpdate(updated);
      setIsEditing(false);
      toast.success("Entity updated");
    } catch {
      toast.error("Failed to update entity");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entity) return;
    try {
      const res = await fetch(`/api/entities/${entity.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entity");
      if (onDelete) onDelete(entity.id);
      toast.success("Entity deleted from archive");
    } catch {
      toast.error("Failed to delete entity");
    }
  };

  if (!entity) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-30 bg-black/40 md:hidden"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="glass-panel-elevated fixed bottom-4 left-4 right-4 z-40 max-h-[80vh] overflow-y-auto rounded-[30px] p-5 shadow-arcane md:bottom-auto md:inset-y-4 md:left-auto md:right-4 md:w-[min(92vw,420px)]"
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-2">
            {isEditing ? (
              <div className="space-y-3 pr-4">
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as EntityType)}
                  className="w-full rounded-xl border border-border bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] px-3 py-2 text-xs uppercase tracking-[0.25em] text-secondary outline-none focus:border-[var(--border-focus)]"
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Entity Name"
                  className="w-full rounded-xl border border-border bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] px-3 py-2 font-heading text-xl text-[var(--accent)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
            ) : (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-secondary">{entity.type}</p>
                <h3 className="truncate font-heading text-4xl text-[var(--accent)]" title={entity.name}>
                  {entity.name}
                </h3>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} title="Cancel">
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSave} disabled={saving} className="text-green-500 hover:text-green-400 hover:bg-green-500/10" title="Save changes">
                  <Save className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {!isReadonly && (
                  <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Edit Entity" className="text-secondary hover:text-white">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose} title="Close">
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <textarea
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            placeholder="Entity summary or description..."
            rows={4}
            className="mb-5 w-full rounded-xl border border-border bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] px-4 py-3 text-sm leading-7 text-secondary outline-none focus:border-[var(--border-focus)]"
          />
        ) : entity.summary ? (
          <p className="mb-5 text-sm leading-7 text-secondary">{entity.summary}</p>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-secondary">Mentioned in lore</p>
          {(entity.lore_chunks ?? []).length === 0 ? (
            <Card className="rounded-[22px] p-4 text-sm text-secondary">
              Matching chunks will appear here as your archive grows.
            </Card>
          ) : (
            entity.lore_chunks?.map((chunk) => (
              <Card key={chunk.id} className="group relative rounded-[22px] p-4 text-sm leading-7 text-secondary">
                {chunk.content}
                <button
                  onClick={() => copyChunk(chunk.id, chunk.content)}
                  className="absolute right-3 top-3 rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(212,168,83,0.1)]"
                  title="Copy to clipboard"
                >
                  {copiedId === chunk.id ? (
                    <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-secondary" />
                  )}
                </button>
              </Card>
            ))
          )}
        </div>

        {entity.type === "character" && (
          <div className="mt-5">
            <Button
              disabled={!canCreateSoul}
              onClick={() => canCreateSoul && onCreateSoul?.(entity.name)}
              className="w-full gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {canCreateSoul ? "Forge Soul from this Character" : "Soul slots full (3/3)"}
            </Button>
          </div>
        )}

        {!isEditing && !isReadonly && (
          <div className="mt-8 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteModalOpen(true)}
              className="text-[var(--danger)] hover:text-[color-mix(in_srgb,var(--danger)_80%,var(--text-main))] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Entity
            </Button>
          </div>
        )}
      </motion.div>

      <DestructiveActionModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Entity"
        description={`Are you sure you want to permanently erase "${entity?.name}" from the archive? Any linked memories and lore references will lose this connection.`}
        requireString={`delete ${entity?.name}`}
        onConfirm={handleDelete}
        isDemo={isReadonly}
      />
    </>
  );
}
