"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpenText,
  Users,
  Sparkles,
  Globe2,
  MessageSquare,
  ShieldAlert,
  Clock,
} from "lucide-react";
import type { Entity, Soul, LoreEntry } from "@/lib/types";

interface CommandPaletteProps {
  worldId?: string;
  entities?: Entity[];
  souls?: Soul[];
  loreEntries?: LoreEntry[];
}

export function CommandPalette({
  worldId,
  entities = [],
  souls = [],
  loreEntries = [],
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Toggle the command palette with Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);

      // Handle soul chat shortcut: "> Chat SoulName"
      if (value.startsWith("chat:")) {
        const soulId = value.replace("chat:", "");
        if (worldId) {
          router.push(`/worlds/${worldId}?section=souls&soul=${soulId}`);
        }
        return;
      }

      // Handle entity navigation
      if (value.startsWith("entity:")) {
        if (worldId) {
          router.push(`/worlds/${worldId}?section=bible`);
        }
        return;
      }

      // Handle lore entry navigation
      if (value.startsWith("lore:")) {
        if (worldId) {
          router.push(`/worlds/${worldId}?section=lore`);
        }
        return;
      }

      // Handle page navigation
      if (value.startsWith("/")) {
        router.push(value);
        return;
      }
    },
    [router, worldId],
  );

  const entityTypeIcons: Record<string, typeof Sparkles> = {
    character: Users,
    location: Globe2,
    faction: ShieldAlert,
    artifact: Sparkles,
    event: Clock,
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />

          {/* Command Dialog */}
          <motion.div
            className="fixed left-1/2 top-[18%] z-[101] w-full max-w-lg -translate-x-1/2"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          >
            <Command
              className="glass-panel-elevated rounded-[24px] overflow-hidden shadow-2xl"
              loop
            >
              <div className="flex items-center gap-2 border-b border-border px-4">
                <Search className="h-4 w-4 shrink-0 text-secondary" />
                <Command.Input
                  placeholder="Search lore, entities, souls... or type > for commands"
                  className="w-full bg-transparent py-3.5 text-sm text-foreground placeholder:text-dim outline-none"
                />
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-[rgba(255,255,255,0.04)] px-1.5 text-[10px] text-dim">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                <Command.Empty className="p-6 text-center text-sm text-secondary">
                  No results found. Try a different search.
                </Command.Empty>

                {/* Quick Navigation */}
                <Command.Group heading="Navigation" className="px-2 py-1">
                  <Command.Item
                    value="/dashboard"
                    onSelect={handleSelect}
                    className="flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm text-foreground cursor-pointer transition-colors data-[selected=true]:bg-[rgba(126,109,242,0.14)]"
                  >
                    <Globe2 className="h-3.5 w-3.5 text-secondary" />
                    Dashboard
                  </Command.Item>
                  {worldId && (
                    <>
                      <Command.Item
                        value={`/worlds/${worldId}?section=lore`}
                        onSelect={() => { setOpen(false); router.push(`/worlds/${worldId}?section=lore`); }}
                        className="flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm text-foreground cursor-pointer transition-colors data-[selected=true]:bg-[rgba(126,109,242,0.14)]"
                      >
                        <BookOpenText className="h-3.5 w-3.5 text-[var(--gold)]" />
                        Lore Scribe
                      </Command.Item>
                      <Command.Item
                        value={`/worlds/${worldId}?section=bible`}
                        onSelect={() => { setOpen(false); router.push(`/worlds/${worldId}?section=bible`); }}
                        className="flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm text-foreground cursor-pointer transition-colors data-[selected=true]:bg-[rgba(126,109,242,0.14)]"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[var(--violet-soft)]" />
                        The Archive
                      </Command.Item>
                    </>
                  )}
                </Command.Group>

                {/* Entities */}
                {entities.length > 0 && (
                  <Command.Group heading="Entities" className="px-2 py-1">
                    {entities.slice(0, 10).map((entity) => {
                      const Icon = entityTypeIcons[entity.type] ?? Sparkles;
                      return (
                        <Command.Item
                          key={entity.id}
                          value={`entity:${entity.id} ${entity.name} ${entity.type}`}
                          onSelect={handleSelect}
                          className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-foreground cursor-pointer transition-colors data-[selected=true]:bg-[rgba(126,109,242,0.14)]"
                        >
                          <Icon className="h-3 w-3 text-secondary" />
                          <span>{entity.name}</span>
                          <span className="ml-auto text-[10px] text-dim uppercase">
                            {entity.type}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {/* Souls */}
                {souls.length > 0 && (
                  <Command.Group heading="Bound Souls" className="px-2 py-1">
                    {souls.map((soul) => (
                      <Command.Item
                        key={soul.id}
                        value={`chat:${soul.id} Chat ${soul.name}`}
                        onSelect={handleSelect}
                        className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-foreground cursor-pointer transition-colors data-[selected=true]:bg-[rgba(126,109,242,0.14)]"
                      >
                        <MessageSquare className="h-3 w-3 text-[var(--violet-soft)]" />
                        <span>Chat with {soul.name}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Lore Entries */}
                {loreEntries.length > 0 && (
                  <Command.Group heading="Lore Entries" className="px-2 py-1">
                    {loreEntries.slice(0, 8).map((entry) => (
                      <Command.Item
                        key={entry.id}
                        value={`lore:${entry.id} ${entry.title ?? "Untitled"}`}
                        onSelect={handleSelect}
                        className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-foreground cursor-pointer transition-colors data-[selected=true]:bg-[rgba(126,109,242,0.14)]"
                      >
                        <BookOpenText className="h-3 w-3 text-[var(--gold)]" />
                        <span className="truncate">{entry.title ?? "Untitled"}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[10px] text-dim">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>Esc Close</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
