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
    <div className="space-y-0.5">
      {entries.map((entry, index) => {
        const isSelected = entry.id === selectedEntryId;
        const preview = stripHtml(entry.content ?? "").slice(0, 55).trim();

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
          >
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors active:scale-[0.98] active:transition-none",
                isSelected
                  ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                  : "hover:bg-[color-mix(in_srgb,var(--text-main)_5%,transparent)]",
              )}
            >
              {/* Active indicator dot */}
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                  isSelected ? "bg-[var(--accent)]" : "bg-[color-mix(in_srgb,var(--text-muted)_40%,transparent)]",
                )}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-[13px] font-medium leading-tight transition-colors",
                    isSelected ? "text-[var(--accent)]" : "text-[var(--text-main)] group-hover:text-[var(--accent)]",
                  )}
                >
                  {entry.title ?? "Untitled Scroll"}
                </p>
                {preview && (
                  <p className="mt-0.5 truncate text-[11px] italic text-[var(--text-muted)]">
                    {preview}…
                  </p>
                )}
                <p suppressHydrationWarning className="mt-0.5 text-[10px] text-[color-mix(in_srgb,var(--text-muted)_70%,transparent)]">
                  {formatRelativeTime(entry.updated_at ?? entry.created_at)}
                </p>
              </div>

              {!isReadonly && onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(entry.id, entry.title ?? undefined); }}
                  title="Delete entry"
                  className="shrink-0 rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-[var(--danger)] text-[var(--text-muted)]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
