"use client";

import { motion } from "framer-motion";
import { ScrollText, Trash2 } from "lucide-react";
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
    <div className="space-y-3">
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
                "rounded-[24px] p-4 transition-all duration-200 cursor-pointer",
                "hover:border-[rgba(212,168,83,0.2)] hover:shadow-tome",
                isSelected ? "border-l-2 border-l-[rgb(212,168,83)] pl-[calc(1rem-2px)]" : "",
              ].join(" ")}
              onClick={() => onSelect(entry)}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-2xl text-foreground">{entry.title ?? "Untitled Scroll"}</p>
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
                  >
                    <ScrollText className="h-4 w-4" />
                    Open Scroll
                  </Button>
                  {!isReadonly && onDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); onDelete(entry.id, entry.title ?? undefined); }}
                      className="px-2 text-secondary hover:bg-red-500/10 hover:text-red-400"
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
