"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Entity } from "@/lib/types";

export function EntityDetailPanel({
  entity,
  onClose,
  canCreateSoul,
  onCreateSoul,
}: {
  entity: Entity | null;
  onClose: () => void;
  canCreateSoul: boolean;
  onCreateSoul?: (name: string) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">{entity.type}</p>
            <h3 className="truncate font-heading text-4xl text-[rgb(212,168,83)]" title={entity.name}>
              {entity.name}
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {entity.summary && (
          <p className="mb-5 text-sm leading-7 text-secondary">{entity.summary}</p>
        )}

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
                    <Check className="h-3.5 w-3.5 text-[rgb(212,168,83)]" />
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
      </motion.div>
    </>
  );
}
