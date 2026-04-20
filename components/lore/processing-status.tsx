"use client";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProcessingStepStatus = "idle" | "active" | "complete";

export interface ProcessingStep {
  id: "saved" | "chunking" | "embedding" | "entities" | "complete";
  label: string;
  status: ProcessingStepStatus;
}

export function ProcessingStatus({ steps }: { steps: ProcessingStep[] }) {
  return (
    <div className="glass-panel rounded-[24px] p-5">
      <p className="font-heading text-2xl text-foreground">Inscribing your lore...</p>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            className="flex items-center gap-3"
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300",
                step.status === "complete"
                  ? "border-[rgba(74,156,109,0.35)] bg-[rgba(74,156,109,0.12)] text-[rgb(183,247,208)]"
                  : step.status === "active"
                    ? "border-[color-mix(in_srgb,var(--ai-pulse)_35%,transparent)] bg-[color-mix(in_srgb,var(--ai-pulse)_15%,transparent)] text-foreground"
                    : "border-border bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] text-secondary",
              )}
            >
              <AnimatePresence mode="wait">
                {step.status === "active" ? (
                  <motion.span
                    key="spinner"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <LoadingSpinner className="h-4 w-4" />
                  </motion.span>
                ) : step.status === "complete" ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <Check className="h-4 w-4" />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
            <span
              className={cn(
                "text-sm transition-colors duration-200",
                step.status === "idle" ? "text-secondary" : "text-foreground",
              )}
            >
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
