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
  { id: "preferences", label: "Preferences", icon: Palette, description: "Theme, sounds, writing" },
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

/* ─── Animation Variants ─── */

const tabContentVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/* ─── Component ─── */

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read and validate the active tab from URL
  const activeTab: SettingsTabId = useMemo(() => {
    const param = searchParams.get("tab");
    if (param && VALID_TAB_IDS.has(param)) {
      return param as SettingsTabId;
    }
    return DEFAULT_TAB;
  }, [searchParams]);

  // Push new history entry on tab click
  const handleTabClick = useCallback(
    (tabId: SettingsTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  return (
    <div className="flex flex-col lg:flex-row lg:gap-8">
      {/* Desktop: Vertical sidebar nav */}
      <nav
        className="hidden lg:flex lg:w-[220px] lg:shrink-0 lg:flex-col lg:gap-1"
        aria-label="Settings navigation"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm transition-colors duration-150",
                isActive
                  ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)] hover:text-[var(--text-main)]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">{tab.label}</span>
                <span className="text-[11px] leading-tight opacity-60">
                  {tab.description}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Mobile: Horizontal scrollable strip */}
      <nav
        className="mb-6 flex gap-1 overflow-x-auto pb-2 lg:hidden scrollbar-hide"
        aria-label="Settings navigation"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-[12px] px-3 py-2 text-sm whitespace-nowrap transition-colors duration-150",
                isActive
                  ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)] hover:text-[var(--text-main)]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab content area with crossfade animation */}
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {children(activeTab)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
