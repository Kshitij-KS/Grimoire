"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpenText, Compass, MessagesSquare, PanelsTopLeft, ShieldAlert } from "lucide-react";
import type { WorldSection } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  {
    key: "lore" as WorldSection,
    icon: BookOpenText,
    label: "Lore",
    subtitle: "The Loom",
  },
  {
    key: "bible" as WorldSection,
    icon: PanelsTopLeft,
    label: "World Bible",
    subtitle: "Constellation",
  },
  {
    key: "souls" as WorldSection,
    icon: MessagesSquare,
    label: "Souls",
    subtitle: "Echoes",
  },
  {
    key: "consistency" as WorldSection,
    icon: ShieldAlert,
    label: "Consistency",
    subtitle: "Fracture Lens",
  },
] as const;

export function AetherDock({ activeSection }: { activeSection: WorldSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (section: WorldSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <nav className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4 lg:hidden">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="glass-panel-elevated flex items-center gap-1 rounded-[26px] px-2 py-2"
      >
        {navItems.map(({ key, icon: Icon, label, subtitle }) => {
          const active = key === activeSection;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(key)}
              className={cn(
                "relative flex min-w-[76px] flex-col items-center gap-1 rounded-[18px] px-3 py-2 transition",
                active ? "bg-[rgba(126,109,242,0.16)] text-foreground" : "text-secondary hover:bg-[rgba(255,255,255,0.03)] hover:text-foreground",
              )}
              title={`${label} — ${subtitle}`}
            >
              <Icon className={cn("h-4 w-4", active ? "text-[rgb(196,168,106)]" : "text-current")} />
              <span className="text-[11px] font-medium">{label}</span>
              <span className="text-[9px] uppercase tracking-[0.16em] opacity-60">{subtitle}</span>
              {active ? (
                <motion.span
                  layoutId="moonlit-dock"
                  className="absolute inset-0 rounded-[18px] border border-[rgba(165,148,255,0.2)]"
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                />
              ) : null}
            </button>
          );
        })}

        <div className="ml-1 hidden h-10 w-px bg-border sm:block" />

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="hidden rounded-[18px] px-3 py-2 text-secondary transition hover:bg-[rgba(255,255,255,0.03)] hover:text-foreground sm:flex sm:flex-col sm:items-center sm:gap-1"
          title="Back to dashboard"
        >
          <Compass className="h-4 w-4" />
          <span className="text-[11px] font-medium">Worlds</span>
          <span className="text-[9px] uppercase tracking-[0.16em] opacity-60">Dashboard</span>
        </button>
      </motion.div>
    </nav>
  );
}
