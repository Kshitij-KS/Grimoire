"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Columns, List, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineEvent {
  id: string;
  name: string;
  era: string;
  order: number;
  summary?: string;
}

// Era color palette cycling
const ERA_COLORS = ["var(--accent)", "var(--ai-pulse)", "var(--success)", "var(--danger)"];

function EventCard({ event, eraColor }: { event: TimelineEvent; eraColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (event.summary?.length ?? 0) > 100;

  return (
    <div
      className="glass-panel flex-1 cursor-pointer rounded-xl p-4 transition-all duration-200 hover:border-[color-mix(in_srgb,var(--border-focus)_50%,transparent)]"
      style={{ borderLeft: `2px solid color-mix(in srgb, ${eraColor} 35%, transparent)` }}
      onClick={() => isLong && setExpanded((v) => !v)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: eraColor }}
          >
            #{event.order}
          </span>
          <h3 className="font-heading text-lg text-[var(--text-main)]">{event.name}</h3>
        </div>
        {isLong && (
          <span className="shrink-0 text-[var(--text-muted)]">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </div>
      {event.summary && (
        <div
          style={{
            maxHeight: expanded || !isLong ? "500px" : "3.5rem",
            overflow: "hidden",
            transition: "max-height 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{event.summary}</p>
        </div>
      )}
    </div>
  );
}

interface TapestryTimelineProps {
  worldId: string;
}

export function TapestryTimeline({ worldId }: TapestryTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizontal, setHorizontal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const eraRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/narrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "timeline", worldId }),
      });
      if (!res.ok) throw new Error("Failed to generate timeline");
      const data = await res.json();
      setEvents(data.timeline ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Timeline generation failed");
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const eras = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const era = event.era || "Unknown Era";
    if (!acc[era]) acc[era] = [];
    acc[era].push(event);
    return acc;
  }, {});

  const eraList = Object.keys(eras);
  const displayedEras = activeFilter ? [activeFilter] : eraList;

  const scrollToEra = (era: string) => {
    setActiveFilter(era === activeFilter ? null : era);
    const el = eraRefs.current[era];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-8">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-[var(--text-main)]">The Tapestry</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Events of your world, woven in chronological order
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHorizontal((v) => !v)}
            title={horizontal ? "Switch to vertical" : "Switch to horizontal"}
            className={`rounded-[12px] border p-2 transition-colors ${
              horizontal
                ? "border-[var(--border-focus)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            {horizontal ? <List className="h-4 w-4" /> : <Columns className="h-4 w-4" />}
          </button>
          <Button variant="secondary" size="sm" onClick={fetchTimeline} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
            Reweave
          </Button>
        </div>
      </div>

      {/* ── Era filter chips ── */}
      {eraList.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              activeFilter === null
                ? "bg-[var(--surface-raised)] text-[var(--text-main)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            All eras
          </button>
          {eraList.map((era, i) => {
            const color = ERA_COLORS[i % ERA_COLORS.length];
            return (
              <button
                key={era}
                onClick={() => scrollToEra(era)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  activeFilter === era
                    ? "text-[var(--text-main)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
                style={
                  activeFilter === era
                    ? { background: `color-mix(in srgb, ${color} 15%, var(--surface-raised))` }
                    : undefined
                }
              >
                {era}
              </button>
            );
          })}
        </div>
      )}

      {loading && events.length === 0 && (
        <motion.div
          className="flex flex-col items-center gap-3 py-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="text-sm text-[var(--text-muted)]">The Oracle weaves the tapestry of time&hellip;</p>
        </motion.div>
      )}

      {error && (
        <div className="glass-panel rounded-[20px] p-6 text-center">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={fetchTimeline}>
            Try Again
          </Button>
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="glass-panel rounded-[20px] p-8 text-center">
          <p
            className="mx-auto mb-3 select-none font-heading text-6xl"
            style={{ color: "var(--accent)", opacity: 0.22 }}
            aria-hidden
          >
            ᚦ
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            No events found. Create entities of type &ldquo;event&rdquo; in your lore to populate the timeline.
          </p>
        </div>
      )}

      {/* ── Timeline rendering ── */}
      {events.length > 0 && (
        horizontal ? (
          /* Horizontal scroll mode */
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto pb-4"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {displayedEras.map((era, eraIndex) => {
              const eraColor = ERA_COLORS[eraIndex % ERA_COLORS.length];
              return (
                <motion.div
                  key={era}
                  ref={(el) => { eraRefs.current[era] = el; }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: eraIndex * 0.08 }}
                  className="min-w-[280px] flex-shrink-0 space-y-3"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <div
                    className="sticky top-0 z-10 rounded-[14px] px-4 py-3"
                    style={{ background: `color-mix(in srgb, ${eraColor} 10%, var(--surface))` }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: eraColor }}>Era</p>
                    <h3 className="font-heading text-2xl" style={{ color: eraColor }}>{era}</h3>
                  </div>
                  {(eras[era] ?? []).map((event, i) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: eraIndex * 0.08 + i * 0.04 }}
                    >
                      <EventCard event={event} eraColor={eraColor} />
                    </motion.div>
                  ))}
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Vertical mode */
          <div className="relative">
            <motion.div
              className="absolute bottom-0 left-6 top-0 w-px origin-top"
              style={{ background: `linear-gradient(to bottom, color-mix(in srgb, var(--accent) 60%, transparent), color-mix(in srgb, var(--ai-pulse) 40%, transparent), transparent)` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />

            <AnimatePresence mode="wait">
              {displayedEras.map((era, eraIndex) => {
                const eraColor = ERA_COLORS[eraIndex % ERA_COLORS.length];
                return (
                  <motion.div
                    key={era}
                    ref={(el) => { eraRefs.current[era] = el; }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, delay: eraIndex * 0.1 }}
                    className="mb-8"
                  >
                    {/* Era header */}
                    <div className="mb-4 flex items-center gap-3 pl-14">
                      <div
                        className="h-px flex-1"
                        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${eraColor} 30%, transparent), transparent)` }}
                      />
                      <span
                        className="chapter-label flex items-center gap-1.5"
                        style={{ color: eraColor }}
                      >
                        <span className="text-[10px] opacity-40">ᚦ</span>
                        {era}
                        <span className="text-[10px] opacity-40">ᚦ</span>
                      </span>
                      <div
                        className="h-px flex-1"
                        style={{ background: `linear-gradient(270deg, color-mix(in srgb, ${eraColor} 30%, transparent), transparent)` }}
                      />
                    </div>

                    {(eras[era] ?? []).map((event, eventIndex) => (
                      <motion.div
                        key={event.id}
                        className="relative mb-4 flex items-start gap-4 pl-4"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: eraIndex * 0.1 + eventIndex * 0.06 }}
                      >
                        {/* Node dot */}
                        <div className="relative z-10 mt-2 flex h-5 w-5 shrink-0 items-center justify-center">
                          <motion.div
                            className="h-3 w-3 rotate-45"
                            style={{ background: eraColor }}
                            animate={{ boxShadow: [
                              `0 0 5px color-mix(in srgb, ${eraColor} 35%, transparent)`,
                              `0 0 14px color-mix(in srgb, ${eraColor} 75%, transparent)`,
                              `0 0 5px color-mix(in srgb, ${eraColor} 35%, transparent)`,
                            ]}}
                            transition={{ duration: 2.4, repeat: Infinity, delay: (eventIndex % 4) * 0.3 }}
                          />
                          <div
                            className="absolute h-5 w-5 rotate-45 border"
                            style={{ borderColor: `color-mix(in srgb, ${eraColor} 30%, transparent)` }}
                          />
                        </div>

                        <EventCard event={event} eraColor={eraColor} />
                      </motion.div>
                    ))}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  );
}
