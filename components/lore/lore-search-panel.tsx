"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoreChunkResult {
  id: string;
  content: string;
  entity_tags?: string[];
  similarity?: number;
}

interface LoreSearchPanelProps {
  worldId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Anchor ref: panel appears below this element */
  anchorRef?: React.RefObject<HTMLElement>;
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function LoreSearchPanel({ worldId, isOpen, onClose, anchorRef }: LoreSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LoreChunkResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 420);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery("");
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Auto-search on debounced query change
  useEffect(() => {
    if (!debouncedQuery || !isOpen) {
      if (!debouncedQuery) {
        setResults([]);
        setHasSearched(false);
      }
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIsSearching(true);
      try {
        const res = await fetch("/api/lore/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worldId, query: debouncedQuery, matchCount: 5 }),
        });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (!cancelled) {
          setResults((data.results ?? data.chunks ?? []) as LoreChunkResult[]);
          setHasSearched(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [debouncedQuery, worldId, isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        if (!anchorRef?.current?.contains(target)) {
          onClose();
        }
      }
    };
    // Delay to avoid same-click that opened the panel
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [isOpen, onClose, anchorRef]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Visual feedback via a short state change would require per-item state;
      // using native clipboard is sufficient here.
    });
  }, []);

  // Trim and excerpt helper
  const excerpt = (text: string, max = 160) => {
    const stripped = text.replace(/\s+/g, " ").trim();
    if (stripped.length <= max) return stripped;
    return stripped.slice(0, max).trimEnd() + "…";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          key="lore-search-panel"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="glass-panel-elevated absolute right-0 top-full z-30 mt-1.5 w-[min(440px,90vw)] rounded-[22px] border border-[var(--border)] p-3 shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
        >
          {/* Search input row */}
          <div className="relative flex items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] px-3 py-2.5 focus-within:border-[var(--border-focus)]">
            {isSearching ? (
              <LoadingSpinner className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            ) : (
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the world's memory…"
              className="flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setResults([]); setHasSearched(false); }}
                className="shrink-0 rounded-md p-0.5 text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                title="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Results / empty states */}
          <div className="mt-2">
            <AnimatePresence mode="wait">
              {!debouncedQuery && !hasSearched ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="py-6 text-center"
                >
                  {/* Arcane idle shimmer */}
                  <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]">
                    <Search className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Search your world&apos;s lore memory</p>
                  <p className="mt-1 text-[10px] text-[color-mix(in_srgb,var(--text-muted)_60%,transparent)]">
                    Semantic search across all inscribed entries
                  </p>
                </motion.div>
              ) : isSearching && results.length === 0 ? (
                <motion.div
                  key="searching"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="py-6 text-center text-xs text-[var(--text-muted)]"
                >
                  Consulting the archive…
                </motion.div>
              ) : hasSearched && results.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="py-6 text-center"
                >
                  <p className="text-sm text-[var(--text-muted)]">The archive holds no memory of this.</p>
                  <p className="mt-1 text-[10px] text-[color-mix(in_srgb,var(--text-muted)_60%,transparent)]">
                    Try different wording or inscribe more lore.
                  </p>
                </motion.div>
              ) : results.length > 0 ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-1.5"
                >
                  {results.map((chunk, i) => (
                    <motion.button
                      key={chunk.id}
                      type="button"
                      onClick={() => handleCopy(chunk.content)}
                      title="Click to copy"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.04 }}
                      className={cn(
                        "group w-full rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-4 py-3 text-left transition",
                        "hover:border-[var(--border-focus)] hover:bg-[color-mix(in_srgb,var(--surface-raised)_80%,transparent)]",
                        "active:scale-[0.99] active:transition-none"
                      )}
                    >
                      {/* Excerpt */}
                      <p className="text-[13px] italic leading-relaxed text-[var(--text-main)] opacity-90">
                        &ldquo;{excerpt(chunk.content)}&rdquo;
                      </p>

                      {/* Tags + copy hint */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {(chunk.entity_tags ?? []).slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2 py-0.5 text-[10px] text-[var(--accent)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="shrink-0 text-[10px] text-[color-mix(in_srgb,var(--text-muted)_60%,transparent)] opacity-0 transition group-hover:opacity-100">
                          Copy
                        </span>
                      </div>
                    </motion.button>
                  ))}

                  <p className="pt-1 text-center text-[10px] text-[color-mix(in_srgb,var(--text-muted)_55%,transparent)]">
                    Click a result to copy it to your clipboard
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
