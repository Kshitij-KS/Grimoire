"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Palette,
  Gauge,
  CreditCard,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Tab Configuration ─── */

export type SettingsTabId =
  | "account"
  | "preferences"
  | "usage"
  | "billing"
  | "danger-zone";

interface SettingsTabConfig {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const SETTINGS_TABS: SettingsTabConfig[] = [
  { id: "account", label: "Account", icon: User, description: "Identity & credentials" },
  { id: "preferences", label: "Preferences", icon: Palette, description: "Theme, sound & writing" },
  { id: "usage", label: "Usage", icon: Gauge, description: "Daily ink & limits" },
  { id: "billing", label: "Billing", icon: CreditCard, description: "Plan & upgrades" },
  { id: "danger-zone", label: "Danger Zone", icon: ShieldAlert, description: "Destructive actions" },
];

const VALID_TAB_IDS = new Set<string>(SETTINGS_TABS.map((t) => t.id));
const DEFAULT_TAB: SettingsTabId = "account";

/* ─── Props ─── */

export interface SettingsLayoutProps {
  children: (activeTab: SettingsTabId) => React.ReactNode;
}

/* ─── Component ─── */

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab: SettingsTabId = useMemo(() => {
    const param = searchParams.get("tab");
    if (param && VALID_TAB_IDS.has(param)) {
      return param as SettingsTabId;
    }
    return DEFAULT_TAB;
  }, [searchParams]);

  const handleTabClick = useCallback(
    (tabId: SettingsTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      {/* ── Desktop: vertical sidebar nav ── */}
      <nav
        className="sticky top-6 hidden w-[244px] shrink-0 lg:block"
        aria-label="Settings navigation"
      >
        <div className="glass-panel flex flex-col gap-1 rounded-[18px] p-2">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDanger = tab.id === "danger-zone";
            const activeColor = isDanger ? "var(--danger)" : "var(--accent)";
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-150",
                  !isActive &&
                    "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-main)_5%,transparent)] hover:text-[var(--text-main)]",
                )}
                style={isActive ? { color: activeColor } : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-tab-active"
                    className="absolute inset-0 rounded-[12px]"
                    style={{
                      background: `color-mix(in srgb, ${activeColor} 11%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${activeColor} 22%, transparent)`,
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                <span className="relative z-10 flex min-w-0 flex-col">
                  <span className="text-sm font-medium leading-tight">{tab.label}</span>
                  <span className="truncate text-[11px] leading-tight opacity-60">
                    {tab.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile: horizontal scrollable strip ── */}
      <nav
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Settings navigation"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDanger = tab.id === "danger-zone";
          const activeColor = isDanger ? "var(--danger)" : "var(--accent)";
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                !isActive &&
                  "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]",
              )}
              style={
                isActive
                  ? {
                      color: activeColor,
                      background: `color-mix(in srgb, ${activeColor} 11%, transparent)`,
                      borderColor: `color-mix(in srgb, ${activeColor} 24%, transparent)`,
                    }
                  : undefined
              }
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Tab content ── */}
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {children(activeTab)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
