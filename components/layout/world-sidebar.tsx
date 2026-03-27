"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
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

  const nextHref = (section: WorldSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="glass-panel sticky top-6 hidden h-[calc(100vh-48px)] w-[240px] shrink-0 rounded-[28px] p-5 lg:flex lg:flex-col">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-secondary">Current world</p>
              <h1 className="font-heading text-4xl text-foreground">{world.name}</h1>
            </div>
            <div className="flex items-center gap-1">
              <AmbientToggle />
              <Link
                href={isDemo ? "/" : "/dashboard"}
                className="rounded-xl p-2 text-secondary transition hover:bg-[rgba(54,44,34,0.3)] hover:text-foreground"
                title={isDemo ? "Back to Home" : "Back to Dashboard"}
              >
                <Compass className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {world.genre ? <Badge>{world.genre}</Badge> : null}
            {world.tone ? <Badge variant="gold">{world.tone}</Badge> : null}
          </div>
        </div>

        {/* ── Nav with spring indicator ── */}
        <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeSection;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => router.push(nextHref(item.key))}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors duration-150",
                  active
                    ? "bg-[rgba(54,44,34,0.3)] text-foreground"
                    : "text-secondary hover:bg-[rgba(54,44,34,0.3)] hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-[rgb(212,168,83)]"
                    style={{ boxShadow: "0 0 14px rgba(212,168,83,0.55)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ── Usage meters ── */}
        <div className="space-y-4 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">Today&apos;s Ink</p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-1 text-secondary transition hover:bg-[rgba(54,44,34,0.4)] hover:text-foreground"
              title="World Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          {usage.map((meter) => {
            const pct = (meter.count / meter.limit) * 100;
            const isWarning = pct >= 80;
            return (
              <div key={meter.action} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary capitalize">
                    {meter.action.replace(/_/g, " ")}
                  </span>
                  <span className={isWarning ? "text-[rgb(212,168,83)]" : "text-secondary"}>
                    {meter.count}/{meter.limit}
                  </span>
                </div>
                <Progress
                  value={pct}
                  className={isWarning ? "[&>div]:bg-[rgb(212,168,83)]" : ""}
                />
              </div>
            );
          })}
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
                "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] transition-colors duration-150",
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
