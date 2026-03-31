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
import { ThemeToggle } from "@/components/shared/theme-toggle";
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
      <aside className="glass-panel sticky top-6 hidden h-[calc(100vh-48px)] w-[220px] shrink-0 rounded-xl lg:flex lg:flex-col overflow-hidden">
        {/* TOP: Pinned Section */}
        <div className="p-5 pb-4 space-y-4 shrink-0 border-b border-[var(--border)]">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)] opacity-70 mb-1">Current world</p>
              <h1
                className="font-heading text-3xl text-[var(--text-main)] truncate transition-colors duration-300 hover:text-[var(--accent)] cursor-default"
                title={world.name}
              >
                {world.name}
              </h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              <AmbientToggle />
              <Link
                href={isDemo ? "/" : "/dashboard"}
                className="rounded-xl p-1.5 text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface)] hover:text-[var(--text-main)] hover:scale-110"
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
              className="group flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <span>Sections</span>
              {isNavOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" /> : <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />}
            </button>
            <AnimatePresence initial={false}>
              {isNavOpen && (
                <motion.nav
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-0.5 overflow-hidden"
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
                          "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-[background,color,transform] duration-150 active:scale-[0.97]",
                          active
                            ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--text-main)]"
                            : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--ai-pulse)_7%,transparent)] hover:text-[var(--text-main)]",
                        )}
                        style={{ transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}
                      >
                        {active && (
                          <motion.span
                            layoutId="indicator"
                            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                            style={{
                              background: "linear-gradient(180deg, var(--accent), var(--ai-pulse))",
                              boxShadow: "0 0 10px color-mix(in srgb, var(--accent) 50%, transparent)",
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 36 }}
                          />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-all duration-150",
                            active
                              ? "text-[var(--accent)] scale-110"
                              : "text-[var(--text-muted)] opacity-55 group-hover:opacity-100 group-hover:text-[var(--ai-pulse-soft)] group-hover:scale-105"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-breathe" />
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
        <div className="mt-auto p-5 pt-4 shrink-0 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setIsUsageOpen(!isUsageOpen)}
              className="group flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <span>Today&apos;s Ink</span>
              {isUsageOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" /> : <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text-main)]"
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
                          <span className="text-[var(--text-muted)] opacity-80 capitalize">
                            {meter.action.replace(/_/g, " ")}
                          </span>
                          <span className={isWarning ? "text-[var(--accent)] font-bold" : "text-[var(--text-muted)] font-medium"}>
                            {meter.count}/{meter.limit}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={cn("h-1", isWarning ? "[&>div]:bg-[var(--accent)]" : "")}
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
        className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-[var(--border)] bg-[var(--bg)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
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
                "group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] transition-[background,color,transform] duration-150 active:scale-[0.92]",
                active
                  ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--text-main)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]",
              )}
              style={{ transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-dot"
                  className="absolute top-1 h-[3px] w-[3px] rounded-full bg-[var(--accent)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform duration-150",
                  active ? "scale-110" : "group-active:scale-90"
                )}
              />
              {item.mobileLabel}
            </button>
          );
        })}
      </div>
    </>
  );
}
