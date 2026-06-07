"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   Shared settings design primitives
   A single visual vocabulary so every tab feels cohesive.
   ───────────────────────────────────────────────────────────── */

type AccentTone = "accent" | "ai-pulse" | "danger" | "success";

const TONE_VAR: Record<AccentTone, string> = {
  accent: "var(--accent)",
  "ai-pulse": "var(--ai-pulse)",
  danger: "var(--danger)",
  success: "var(--success)",
};

/* ─── Section Card ─── */

interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: AccentTone;
  /** Optional element rendered at the top-right of the header (e.g. a badge). */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  tone = "accent",
  aside,
  className,
  children,
}: SettingsSectionProps) {
  const color = TONE_VAR[tone];
  return (
    <section
      className={cn(
        "glass-panel rounded-[20px] p-6 sm:p-7",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            <Icon className="h-[18px] w-[18px]" style={{ color }} />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading text-2xl leading-none text-foreground">
              {title}
            </h2>
            {description && (
              <p className="text-sm leading-6 text-secondary">{description}</p>
            )}
          </div>
        </div>
        {aside}
      </header>

      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ─── Setting Row — label + description on the left, control on the right ─── */

interface SettingRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  control: React.ReactNode;
  /** Stack the control beneath the label instead of side-by-side. */
  stacked?: boolean;
  disabled?: boolean;
}

export function SettingRow({
  label,
  description,
  htmlFor,
  control,
  stacked = false,
  disabled = false,
}: SettingRowProps) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div
      className={cn(
        "rounded-[14px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3.5",
        stacked
          ? "space-y-3"
          : "flex items-center justify-between gap-4",
        disabled && "opacity-55",
      )}
    >
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        className={cn("min-w-0", htmlFor && !disabled && "cursor-pointer")}
      >
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-secondary">{description}</p>
        )}
      </Label>
      <div className={cn(stacked ? "w-full" : "shrink-0")}>{control}</div>
    </div>
  );
}

/* ─── Group label — a small uppercase divider heading within a section ─── */

export function SettingsGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary">
      {children}
    </p>
  );
}
