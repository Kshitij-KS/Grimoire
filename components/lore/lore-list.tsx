"use client";

import { motion } from "framer-motion";
import { ArrowRight, ScrollText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelativeTime, stripHtml, wordCount } from "@/lib/utils";
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
    <div className="space-y-2.5">
      {entries.map((entry, index) => {
        const preview = stripHtml(entry.content ?? "").slice(0, 90).trim();
        const isSelected = entry.id === selectedEntryId;

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
          >
            <Card
              className={[
                "group relative overflow-hidden rounded-[14px] p-4 transition-all duration-250 cursor-pointer",
                isSelected
                  ? "border-l-[3px] border-l-[rgb(212,168,83)] pl-[calc(1rem-3px)] shadow-[0_0_24px_rgba(196,168,106,0.12),-2px_0_12px_rgba(196,168,106,0.15)]"
                  : "hover:border-[rgba(212,168,83,0.24)] hover:shadow-[0_8px_32px_rgba(4,6,12,0.4),0_0_20px_rgba(196,168,106,0.06)]",
              ].join(" ")}
              onClick={() => onSelect(entry)}
            >
              {/* Ambient top-left glow on hover */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-[24px]"  style={{ background: "radial-gradient(ellipse 60% 40% at 10% 10%, rgba(196,168,106,0.06), transparent 60%)" }} />
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-2xl text-foreground transition-colors duration-200 group-hover:text-[var(--silver)]">
                    {entry.title ?? "Untitled Scroll"}
                  </p>
                  {preview ? (
                    <p className="mt-1 line-clamp-1 text-sm italic text-secondary">
                      {preview}&hellip;
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-secondary">
                    {formatRelativeTime(entry.updated_at ?? entry.created_at)}
                    {" · "}
                    <span className="text-[rgb(139,120,80)]">~{wordCount(entry.content)} words</span>
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); onSelect(entry); }}
                    className="opacity-0 transition-all duration-200 group-hover:opacity-100 gap-1.5"
                  >
                    <ScrollText className="h-3.5 w-3.5" />
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                  {!isReadonly && onDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); onDelete(entry.id, entry.title ?? undefined); }}
                      className="px-2 text-secondary opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
