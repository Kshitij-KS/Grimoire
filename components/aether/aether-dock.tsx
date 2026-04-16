"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpenText,
  Compass,
  MessagesSquare,
  MoreHorizontal,
  PanelsTopLeft,
  ScrollText,
  ShieldAlert,
  Swords,
  Telescope,
  X,
} from "lucide-react";
import Link from "next/link";
import type { WorldSection } from "@/lib/constants";
import { cn } from "@/lib/utils";

const primaryItems: { key: WorldSection; icon: React.ElementType; label: string; subtitle: string }[] = [
  { key: "lore",        icon: BookOpenText,  label: "Lore",     subtitle: "The Loom"  },
  { key: "bible",       icon: PanelsTopLeft, label: "Archive",  subtitle: "Bible"     },
  { key: "souls",       icon: MessagesSquare,label: "Souls",    subtitle: "Echoes"    },
  { key: "consistency", icon: ShieldAlert,   label: "Lens",     subtitle: "Eye"       },
];

const moreItems: { key: WorldSection; icon: React.ElementType; label: string; subtitle: string }[] = [
  { key: "tapestry", icon: ScrollText, label: "Tapestry", subtitle: "Timeline"   },
  { key: "tavern",   icon: Swords,     label: "Tavern",   subtitle: "Multi-Soul" },
  { key: "narrator", icon: Telescope,  label: "Tools",    subtitle: "What-If"    },
];

export function AetherDock({ activeSection }: { activeSection: WorldSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollFraction, setScrollFraction] = useState(0);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const navigate = (section: WorldSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    router.push(`${pathname}?${params.toString()}`);
    setMoreSheetOpen(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    setScrollFraction(max > 0 ? el.scrollLeft / max : 0);
  };

  return (
    <>
      {/* Backdrop for more sheet */}
      <AnimatePresence>
        {moreSheetOpen && (
          <motion.div
            key="more-backdrop"
            className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setMoreSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More sheet */}
      <AnimatePresence>
        {moreSheetOpen && (
          <motion.div
            key="more-sheet"
            className="fixed bottom-[80px] left-3 right-3 z-50 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 pb-4 pt-3 shadow-[0_-8px_32px_color-mix(in_srgb,var(--bg)_60%,transparent)] lg:hidden"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-[var(--border)]" />

            {/* Section grid */}
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map(({ key, icon: Icon, label, subtitle }) => {
                const active = key === activeSection;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(key)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-3 py-3 transition-all duration-150 active:scale-[0.96] active:transition-none",
                      active
                        ? "border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-main)]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium">{label}</span>
                    <span className="text-[9px] uppercase tracking-[0.14em] opacity-55">{subtitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Dashboard link */}
            <Link
              href="/dashboard"
              onClick={() => setMoreSheetOpen(false)}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 text-xs font-medium text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-main)] active:scale-[0.97] active:transition-none"
            >
              <Compass className="h-3.5 w-3.5" />
              All Worlds
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main dock */}
      <nav className="fixed bottom-4 left-0 right-0 z-50 flex flex-col items-center gap-1.5 px-3 lg:hidden">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="glass-panel-elevated relative w-full max-w-full rounded-[26px] py-2"
        >
          {/* Left fade hint (only on scrollable side) */}
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-5 rounded-l-[26px] bg-gradient-to-r from-[color-mix(in_srgb,var(--surface-raised)_95%,transparent)] to-transparent" />

          <div className="flex items-center">
            {/* Scrollable primary items */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="aether-dock-scroll flex min-w-0 flex-1 items-center gap-0.5 px-2"
            >
              {primaryItems.map(({ key, icon: Icon, label, subtitle }) => {
                const active = key === activeSection;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(key)}
                    className={cn(
                      "aether-dock-snap-item relative flex min-w-[68px] shrink-0 flex-col items-center gap-0.5 rounded-[18px] px-2.5 py-2",
                      "transition-colors duration-150",
                      active
                        ? "text-[var(--text-main)]"
                        : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] hover:text-[var(--text-main)]",
                      "active:scale-[0.95] active:transition-none",
                    )}
                    title={`${label} — ${subtitle}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="moonlit-dock"
                        className="absolute inset-0 rounded-[18px] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                        transition={{ type: "spring", stiffness: 360, damping: 30 }}
                      />
                    )}
                    <Icon className={cn("relative z-10 h-4 w-4", active && "text-[var(--accent)]")} />
                    <span className="relative z-10 text-[10px] font-medium">{label}</span>
                    <span className="relative z-10 text-[8px] uppercase tracking-[0.14em] opacity-55">{subtitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Pinned More button — always visible */}
            <div className="flex shrink-0 items-center pr-1.5">
              <div className="mx-1 h-8 w-px bg-[var(--border)]" />
              <button
                type="button"
                onClick={() => setMoreSheetOpen((v) => !v)}
                className={cn(
                  "relative flex min-w-[64px] shrink-0 flex-col items-center gap-0.5 rounded-[18px] px-2.5 py-2 transition-colors duration-150 active:scale-[0.95] active:transition-none",
                  moreSheetOpen
                    ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] hover:text-[var(--text-main)]"
                )}
                title="More sections"
              >
                <motion.span
                  animate={{ rotate: moreSheetOpen ? 45 : 0 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  className="relative z-10"
                >
                  {moreSheetOpen ? <X className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
                </motion.span>
                <span className="relative z-10 text-[10px] font-medium">More</span>
                <span className="relative z-10 text-[8px] uppercase tracking-[0.14em] opacity-55">Sections</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Scroll position indicator */}
        <div className="flex justify-center">
          <div className="h-0.5 w-10 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)]">
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: "40%" }}
              animate={{ x: `${scrollFraction * 150}%` }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </div>
        </div>
      </nav>
    </>
  );
}
