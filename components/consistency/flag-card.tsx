"use client";

import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ConsistencyFlag } from "@/lib/types";

const SEVERITY_CONFIG = {
  high: {
    label: "High tension",
    labelClass: "text-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] border-[color-mix(in_srgb,var(--danger)_30%,transparent)]",
    borderStyle: {
      borderLeftColor: "color-mix(in srgb, var(--danger) 50%, transparent)",
      borderLeftWidth: "6px",
      animation: "flagPulseHigh 2s ease-in-out infinite",
    },
    Icon: AlertTriangle,
    iconClass: "text-[var(--danger)]",
  },
  medium: {
    label: "Medium tension",
    labelClass: "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
    borderStyle: { borderLeftColor: "color-mix(in srgb, var(--accent) 50%, transparent)", borderLeftWidth: "4px" },
    Icon: AlertCircle,
    iconClass: "text-[var(--accent)]",
  },
  low: {
    label: "Low tension",
    labelClass: "text-[var(--ai-pulse-soft)] bg-[color-mix(in_srgb,var(--ai-pulse)_12%,transparent)] border-[color-mix(in_srgb,var(--ai-pulse)_30%,transparent)]",
    borderStyle: { borderLeftColor: "color-mix(in srgb, var(--ai-pulse) 40%, transparent)", borderLeftWidth: "2px" },
    Icon: Info,
    iconClass: "text-[var(--ai-pulse-soft)]",
  },
};

export function FlagCard({
  flag,
  onResolve,
  onUnresolve,
}: {
  flag: ConsistencyFlag;
  onResolve?: (id: string) => void;
  onUnresolve?: (id: string) => void;
}) {
  const config =
    SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low;
  const { Icon } = config;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: -40, scale: 0.92, filter: "blur(3px)" }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <Card
        className={["rounded-[28px] border-l p-5", flag.resolved ? "opacity-50" : ""].join(" ")}
        style={config.borderStyle}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${config.iconClass}`} />
            <div
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${config.labelClass}`}
            >
              {config.label}
            </div>
          </div>
          {!flag.resolved ? (
            <Button variant="secondary" size="sm" onClick={() => onResolve?.(flag.id)} disabled={!onResolve}>
              Resolve
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onUnresolve?.(flag.id)} disabled={!onUnresolve}>
              Undo resolve
            </Button>
          )}
        </div>

        <p className="mt-4 rounded-2xl bg-[rgba(212,168,83,0.06)] p-3 text-sm italic text-[rgb(240,220,160)]">
          &ldquo;{flag.flagged_text}&rdquo;
        </p>

        <div className="mt-4 space-y-2 text-sm text-secondary">
          <p className="font-medium text-foreground">The tension:</p>
          <p className="leading-7">{flag.contradiction}</p>
          {flag.existing_reference ? (
            <p className="italic opacity-70">
              From the archive: &ldquo;{flag.existing_reference}&rdquo;
            </p>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}
