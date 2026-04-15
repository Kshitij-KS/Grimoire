"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpenText,
  Compass,
  MessagesSquare,
  PanelsTopLeft,
  ScrollText,
  ShieldAlert,
  Swords,
  Telescope,
} from "lucide-react";
import type { WorldSection } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems: { key: WorldSection; icon: React.ElementType; label: string; subtitle: string }[] = [
  { key: "lore",        icon: BookOpenText,  label: "Lore",        subtitle: "The Loom"    },
  { key: "bible",       icon: PanelsTopLeft, label: "Archive",     subtitle: "Bible"       },
  { key: "souls",       icon: MessagesSquare,label: "Souls",       subtitle: "Echoes"      },
  { key: "consistency", icon: ShieldAlert,   label: "Narrator",    subtitle: "Eye"         },
  { key: "tapestry",    icon: ScrollText,    label: "Tapestry",    subtitle: "Timeline"    },
  { key: "tavern",      icon: Swords,        label: "Tavern",      subtitle: "Multi-Soul"  },
  { key: "narrator",    icon: Telescope,     label: "Tools",       subtitle: "What-If"     },
];

export function AetherDock({ activeSection }: { activeSection: WorldSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollFraction, setScrollFraction] = useState(0);

  const navigate = (section: WorldSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    setScrollFraction(max > 0 ? el.scrollLeft / max : 0);
  };

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 flex flex-col items-center gap-1.5 px-3 lg:hidden">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="glass-panel-elevated relative w-full max-w-full rounded-[26px] py-2"
      >
        {/* Fade hints on edges */}
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-6 rounded-l-[26px] bg-gradient-to-r from-[color-mix(in_srgb,var(--surface-raised)_95%,transparent)] to-transparent" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-6 rounded-r-[26px] bg-gradient-to-l from-[color-mix(in_srgb,var(--surface-raised)_95%,transparent)] to-transparent" />

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="aether-dock-scroll flex items-center gap-0.5 px-2"
        >
          {navItems.map(({ key, icon: Icon, label, subtitle }) => {
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

          <div className="mx-1 h-8 w-px shrink-0 bg-[var(--border)]" />

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="aether-dock-snap-item relative flex min-w-[68px] shrink-0 flex-col items-center gap-0.5 rounded-[18px] px-2.5 py-2 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] hover:text-[var(--text-main)] active:scale-[0.95] active:transition-none"
            title="Back to dashboard"
          >
            <Compass className="h-4 w-4" />
            <span className="text-[10px] font-medium">Worlds</span>
            <span className="text-[8px] uppercase tracking-[0.14em] opacity-55">Home</span>
          </button>
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
  );
}
