"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpenText,
  Compass,
  PanelsTopLeft,
  Settings,
  ShieldAlert,
  Sparkles,
  Clock,
  Users,
  Wand2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AmbientToggle } from "@/components/shared/ambient-audio";
import { WorldSettingsDrawer } from "@/components/layout/world-settings-drawer";
import { cn } from "@/lib/utils";
import type { UsageMeter, World } from "@/lib/types";
import type { WorldSection } from "@/lib/constants";

const items: Array<{
  key: WorldSection;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
    { key: "lore", label: "Lore Scribe", mobileLabel: "Scribe", icon: BookOpenText },
    { key: "bible", label: "The Archive", mobileLabel: "Archive", icon: PanelsTopLeft },
    { key: "souls", label: "Bound Souls", mobileLabel: "Souls", icon: Sparkles },
    { key: "consistency", label: "Narrator's Eye", mobileLabel: "Eye", icon: ShieldAlert },
    { key: "tapestry", label: "The Tapestry", mobileLabel: "Time", icon: Clock },
    { key: "tavern", label: "The Tavern", mobileLabel: "Tavern", icon: Users },
    { key: "narrator", label: "Narrator's Tools", mobileLabel: "Tools", icon: Wand2 },
  ];

export function WorldSidebar({
  world,
  usage,
  activeSection,
  isDemo = false,
}: {
  world: World;
  usage: UsageMeter[];
  activeSection: WorldSection;
  isDemo?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isUsageOpen, setIsUsageOpen] = useState(true);

  const nextHref = (section: WorldSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="glass-panel sticky top-6 hidden h-[calc(100vh-48px)] w-[240px] shrink-0 rounded-2xl lg:flex lg:flex-col overflow-hidden">
        {/* TOP: Pinned Section */}
        <div className="p-5 pb-4 space-y-4 shrink-0 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] text-secondary/70 mb-1">Current world</p>
              <h1
                className="font-heading text-3xl text-foreground truncate transition-colors duration-300 hover:text-[var(--gold-soft)] cursor-default"
                title={world.name}
              >
                {world.name}
              </h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <AmbientToggle />
              <Link
                href={isDemo ? "/" : "/dashboard"}
                className="rounded-xl p-1.5 text-secondary transition-all duration-200 hover:bg-[rgba(54,44,34,0.3)] hover:text-foreground hover:scale-110"
                title={isDemo ? "Back to Home" : "Back to Dashboard"}
              >
                <Compass className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {world.genre ? <Badge className="text-[10px] px-2 py-0">{world.genre}</Badge> : null}
            {world.tone ? <Badge variant="gold" className="text-[10px] px-2 py-0">{world.tone}</Badge> : null}
          </div>
        </div>

        {/* MIDDLE: Scrollable & Collapsible Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pt-4 space-y-4 scrollbar-thin">
          <div className="space-y-2">
            <button 
              onClick={() => setIsNavOpen(!isNavOpen)}
              className="group flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-[0.15em] text-secondary hover:text-foreground transition-colors"
            >
              <span>Chronicles</span>
              {isNavOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" /> : <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />}
            </button>
            <AnimatePresence initial={false}>
              {isNavOpen && (
                <motion.nav 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1 overflow-hidden"
                >
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = item.key === activeSection;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => router.push(nextHref(item.key))}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-all duration-200",
                          active
                            ? "bg-[rgba(196,168,106,0.08)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_16px_rgba(4,6,12,0.3)]"
                            : "text-secondary hover:bg-[rgba(165,148,255,0.06)] hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="indicator"
                            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                            style={{
                              background: "linear-gradient(180deg, rgba(196,168,106,0.9), rgba(165,148,255,0.7))",
                              boxShadow: "0 0 8px rgba(196,168,106,0.4)",
                            }}
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-all duration-200",
                            active
                              ? "text-[rgb(212,168,83)] scale-110"
                              : "opacity-60 group-hover:opacity-100 group-hover:text-[rgba(165,148,255,0.8)]"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[rgb(196,168,106)] opacity-70 animate-breathe" />
                        )}
                      </button>
                    );
                  })}
                </motion.nav>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* BOTTOM: Pinned & Collapsible Usage */}
        <div className="mt-auto p-5 pt-4 shrink-0 border-t border-border/50 bg-[linear-gradient(to_top,rgba(11,15,24,0.4),transparent)]">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={() => setIsUsageOpen(!isUsageOpen)}
              className="group flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-secondary hover:text-foreground transition-colors"
            >
              <span>Today&apos;s Ink</span>
              {isUsageOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" /> : <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-1.5 text-secondary transition hover:bg-[rgba(54,44,34,0.4)] hover:text-foreground"
              title="World Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {isUsageOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="space-y-3.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {usage.map((meter) => {
                    const pct = (meter.count / meter.limit) * 100;
                    const isWarning = pct >= 80;
                    return (
                      <div key={meter.action} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-secondary/80 capitalize">
                            {meter.action.replace(/_/g, " ")}
                          </span>
                          <span className={isWarning ? "text-[rgb(212,168,83)] font-bold" : "text-secondary font-medium"}>
                            {meter.count}/{meter.limit}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={cn("h-1", isWarning ? "[&>div]:bg-[rgb(212,168,83)]" : "")}
                        />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* ── Settings Drawer ── */}
      <WorldSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        world={world}
        usage={usage}
        isDemo={isDemo}
      />
      {/* ── Mobile bottom nav ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-border bg-[rgba(13,11,8,0.96)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = item.key === activeSection;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(nextHref(item.key))}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] transition-colors duration-150",
                active ? "bg-[rgba(124,92,191,0.14)] text-foreground" : "text-secondary",
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-dot"
                  className="absolute top-1 h-[3px] w-[3px] rounded-full bg-[rgb(212,168,83)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4" />
              {item.mobileLabel}
            </button>
          );
        })}
      </div>
    </>
  );
}
