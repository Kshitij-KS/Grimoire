"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, MoreHorizontal, ScrollText, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { initialsFromName } from "@/lib/utils";
import type { Soul } from "@/lib/types";

const GENERATING_LABELS = [
  "Binding soul to lore…",
  "Forging voice…",
  "Awakening…",
];

function GeneratingLabel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % GENERATING_LABELS.length), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={idx}
        className="mt-1 text-sm italic text-[var(--text-muted)]"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25 }}
      >
        {GENERATING_LABELS[idx]}
      </motion.p>
    </AnimatePresence>
  );
}

export function SoulCard({
  soul,
  worldId: _worldId, // eslint-disable-line @typescript-eslint/no-unused-vars
  isDemo = false,
  onChat,
  onView,
  onDelete,
}: {
  soul: Soul;
  worldId: string;
  isDemo?: boolean;
  onChat?: () => void;
  onView: () => void;
  onDelete?: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isGenerating = !soul.soul_card;
  const color = soul.avatar_color ?? "rgb(124,92,191)";
  const initials = soul.avatar_initials ?? initialsFromName(soul.name);
  const sampleLines = soul.soul_card?.sample_lines ?? [];
  const quoteToShow = sampleLines[0];

  return (
    <motion.div
      className="group"
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
    >
      <Card className="relative flex flex-col overflow-hidden rounded-[16px] p-0">
        {/* ── Avatar section ── */}
        <div
          className="relative flex h-44 items-center justify-center overflow-hidden"
          style={{
            background: `radial-gradient(circle at 50% 60%, ${color}28, transparent 70%)`,
          }}
        >
          {/* Color accent top line */}
          <div
            className="absolute inset-x-0 top-0 h-[2px] opacity-55 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: `linear-gradient(90deg, ${color}dd, ${color}44, transparent)` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-15" />

          <span
            className="pointer-events-none absolute select-none font-heading text-[7rem] font-bold opacity-[0.04]"
            style={{ color }}
            aria-hidden
          >
            {initials.slice(0, 1)}
          </span>

          <Avatar
            className={`relative z-10 h-24 w-24 border-2 transition-transform duration-300 group-hover:scale-105 ${isGenerating ? "soul-glow-ring" : ""}`}
            style={{
              borderColor: color,
              boxShadow: `0 0 32px ${color}44`,
            }}
          >
            <AvatarFallback
              className="font-heading text-2xl"
              style={{ background: `${color}22`, color }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {isGenerating && (
            <span
              className="absolute inset-[26px] z-20 animate-ping rounded-full border-2 opacity-25"
              style={{ borderColor: color }}
            />
          )}

          {/* Delete / more menu — top-right corner */}
          {!isDemo && onDelete && (
            <div className="absolute right-3 top-3 z-20">
              <button
                className="rounded-lg p-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100"
                style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}
                onClick={(e) => { e.preventDefault(); onDelete(soul.id); }}
                title="Release this soul"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Name + voice ── */}
        <div className="px-5 pb-2 pt-4">
          <h3 className="font-heading text-3xl leading-tight text-[var(--text-main)]">{soul.name}</h3>
          {isGenerating ? (
            <GeneratingLabel />
          ) : (
            <p className="mt-1 line-clamp-2 text-sm italic leading-6 text-[var(--text-muted)]">
              {soul.soul_card?.voice ?? "Soul card shaping..."}
            </p>
          )}
        </div>

        {/* ── Quote strip — visible at rest, brighter on hover ── */}
        {quoteToShow && !isGenerating && (
          <div className="px-5 pb-2">
            <p
              className="truncate border-l-2 pl-3 text-xs italic leading-5 text-[var(--text-muted)] opacity-65 transition-opacity duration-300 group-hover:opacity-90"
              style={{ borderLeftColor: color }}
            >
              &ldquo;{quoteToShow}&rdquo;
            </p>
          </div>
        )}

        {/* ── Action footer ── */}
        <div className="relative mt-auto border-t border-[var(--border)] px-5 py-4">
          {isGenerating ? (
            <div className="h-9 animate-pulse rounded-[10px] bg-[var(--surface-raised)]" />
          ) : (
            <div className="flex items-center gap-2">
              {/* Primary CTA — full width Speak button */}
              <Button
                className="flex-1 gap-2"
                size="sm"
                onClick={onChat}
                disabled={!onChat && !isDemo}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Speak
              </Button>

              {/* Secondary overflow menu */}
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  className="px-2.5"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
                      className="glass-panel-elevated absolute bottom-full right-0 mb-2 min-w-[140px] overflow-hidden rounded-[12px] border border-[var(--border)] py-1"
                      onMouseLeave={() => setMenuOpen(false)}
                    >
                      <button
                        onClick={() => { setMenuOpen(false); onView(); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-main)]"
                      >
                        <ScrollText className="h-3.5 w-3.5" />
                        Soul Card
                      </button>
                      {!isDemo && onDelete && (
                        <button
                          onClick={() => { setMenuOpen(false); onDelete(soul.id); }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Release Soul
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
