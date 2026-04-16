"use client";

import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatRelativeTime, stripHtml } from "@/lib/utils";
import type { LoreEntry } from "@/lib/types";

export function LoreList({
  entries,
  onSelect,
  selectedEntryId,
  isReadonly,
  onDelete,
}: {
  entries: LoreEntry[];
  onSelect: (entry: LoreEntry) => void;
  selectedEntryId?: string;
  isReadonly?: boolean;
  onDelete?: (id: string, title?: string) => void;
}) {
  if (entries.length === 0) {
    return <EmptyState variant="lore" />;
  }

  return (
    <div className="space-y-px">
      {entries.map((entry, index) => {
        const isSelected = entry.id === selectedEntryId;
        const preview = stripHtml(entry.content ?? "").slice(0, 48).trim();
        const date = new Date(entry.updated_at ?? entry.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: index * 0.02, ease: [0.23, 1, 0.32, 1] }}
          >
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className={cn(
                "group relative flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2.5 text-left transition-all active:scale-[0.98]",
                isSelected
                  ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                  : "hover:bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "truncate text-[12px] font-semibold leading-tight tracking-tight px-0.5 transition-colors",
                    isSelected ? "text-[var(--accent)]" : "text-[var(--text-main)] group-hover:text-[var(--accent)]",
                  )}
                >
                  {entry.title || "Untitled Scroll"}
                </p>

                <span className="text-[9px] font-medium tracking-tight text-[var(--text-muted)] opacity-50 tabular-nums">
                  {date}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate px-0.5 text-[11px] italic leading-relaxed text-[var(--text-muted)] opacity-80">
                  {preview || "Whispers of a blank page..."}{preview.length >= 48 && "…"}
                </p>

                {!isReadonly && onDelete && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id, entry.title ?? undefined); }}
                    className="shrink-0 -mr-1 -mt-0.5 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-[var(--danger)] text-[var(--text-muted)]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Selection indicator — subtle vertical bar */}
              {isSelected && (
                <motion.div
                  layoutId="entry-select"
                  className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full bg-[var(--accent)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
