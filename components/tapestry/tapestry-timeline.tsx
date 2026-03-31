"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineEvent {
  id: string;
  name: string;
  era: string;
  order: number;
  summary?: string;
}

interface TapestryTimelineProps {
  worldId: string;
}

export function TapestryTimeline({ worldId }: TapestryTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = async () => {
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
  };

  useEffect(() => {
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId]);

  // Group events by era
  const eras = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const era = event.era || "Unknown Era";
    if (!acc[era]) acc[era] = [];
    acc[era].push(event);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-3xl text-foreground">The Tapestry</h2>
          <p className="text-sm text-secondary">
            Events of your world, woven in chronological order
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchTimeline}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
          Reweave
        </Button>
      </div>

      {loading && events.length === 0 && (
        <motion.div
          className="flex flex-col items-center gap-3 py-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--violet)] border-t-transparent" />
          <p className="text-sm text-secondary">The Oracle weaves the tapestry of time&hellip;</p>
        </motion.div>
      )}

      {error && (
        <div className="glass-panel rounded-[20px] p-6 text-center">
          <p className="text-sm text-[rgb(var(--danger-rgb))]">{error}</p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={fetchTimeline}>
            Try Again
          </Button>
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="glass-panel rounded-[20px] p-8 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-secondary" />
          <p className="text-sm text-secondary">
            No events found. Create entities of type &ldquo;event&rdquo; in your lore to populate the timeline.
          </p>
        </div>
      )}

      {/* ── Timeline Rendering ── */}
      <div className="relative">
        {/* Vertical line */}
        {events.length > 0 && (
          <motion.div
            className="absolute left-6 top-0 bottom-0 w-px origin-top"
            style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--accent) 60%, transparent), color-mix(in srgb, var(--ai-pulse) 40%, transparent), transparent)" }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )}

        <AnimatePresence mode="wait">
          {Object.entries(eras).map(([era, eraEvents], eraIndex) => (
            <motion.div
              key={era}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: eraIndex * 0.1 }}
              className="mb-8"
            >
              {/* Era label */}
              <div className="mb-4 flex items-center gap-3 pl-14">
                <div className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_srgb,var(--accent)_22%,transparent)] to-transparent" />
                <span className="chapter-label text-[var(--gold)] flex items-center gap-1.5">
                  <span className="text-[10px] opacity-40">ᚦ</span>
                  {era}
                  <span className="text-[10px] opacity-40">ᚦ</span>
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-[color-mix(in_srgb,var(--accent)_22%,transparent)] to-transparent" />
              </div>

              {eraEvents.map((event, eventIndex) => (
                <motion.div
                  key={event.id}
                  className="relative mb-4 flex items-start gap-4 pl-4"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: eraIndex * 0.1 + eventIndex * 0.06,
                  }}
                >
                  {/* Node dot */}
                  <div className="relative z-10 mt-2 flex h-5 w-5 shrink-0 items-center justify-center">
                    <motion.div
                      className="h-3 w-3 rotate-45 bg-[var(--gold)]"
                      animate={{ boxShadow: ["0 0 5px color-mix(in srgb, var(--accent) 35%, transparent)", "0 0 14px color-mix(in srgb, var(--accent) 75%, transparent)", "0 0 5px color-mix(in srgb, var(--accent) 35%, transparent)"] }}
                      transition={{ duration: 2.4, repeat: Infinity, delay: (eventIndex % 4) * 0.3 }}
                    />
                    <div className="absolute h-5 w-5 rotate-45 border border-[color-mix(in_srgb,var(--accent)_30%,transparent)]" />
                  </div>

                  {/* Event card */}
                  <div className="glass-panel flex-1 rounded-xl p-4 transition-all duration-200 hover:border-[rgba(90,72,52,0.55)] hover:shadow-[0_4px_20px_rgba(2,1,0,0.45)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-[var(--gold)] uppercase tracking-wider">
                        #{event.order}
                      </span>
                      <h3 className="font-heading text-lg text-foreground">
                        {event.name}
                      </h3>
                    </div>
                    {event.summary && (
                      <p className="mt-1 text-xs leading-5 text-secondary">
                        {event.summary}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
