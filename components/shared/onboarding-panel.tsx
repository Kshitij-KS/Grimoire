"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { ONBOARDING_STEPS } from "@/lib/onboarding-steps";
import { cn } from "@/lib/utils";

interface OnboardingPanelProps {
  /** Current step index (0-3) */
  currentStep: number;
  /** Array of 4 booleans indicating which steps are completed */
  completedSteps: [boolean, boolean, boolean, boolean];
  /** Whether onboarding has been dismissed */
  isDismissed: boolean;
  /** Whether all steps are completed */
  isFinished: boolean;
  /** Whether entities are currently being extracted (step 2 waiting state) */
  isExtractingEntities?: boolean;
  /** Callback to dismiss the onboarding panel */
  onDismiss: () => void;
}

/**
 * Persistent onboarding guide panel shown to first-time users.
 * Displays current step, progress indicator, completion checkmarks,
 * and a dismiss button. Styled with the dark fantasy design system.
 */
export function OnboardingPanel({
  currentStep,
  completedSteps,
  isDismissed,
  isFinished,
  isExtractingEntities = false,
  onDismiss,
}: OnboardingPanelProps) {
  // Don't render if finished or dismissed
  if (isFinished || isDismissed) return null;

  const completedCount = completedSteps.filter(Boolean).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-6 right-6 z-50 w-[320px] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[var(--surface)] shadow-arcane-glow"
        role="complementary"
        aria-label="Onboarding guide"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--accent)_12%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Getting Started
            </span>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
              {completedCount} of {ONBOARDING_STEPS.length}
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:text-[var(--text-main)]"
            aria-label="Dismiss onboarding guide"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-[color-mix(in_srgb,var(--border)_40%,transparent)]">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--accent)] to-[color-mix(in_srgb,var(--accent)_70%,var(--ai-pulse))]"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / ONBOARDING_STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Steps list */}
        <div className="space-y-0.5 p-3">
          {ONBOARDING_STEPS.map((step, index) => {
            const isCompleted = completedSteps[index];
            const isCurrent = index === currentStep && !isCompleted;
            const isWaiting = isCurrent && index === 1 && isExtractingEntities;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  isCurrent && "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
                  !isCurrent && !isCompleted && "opacity-50"
                )}
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                    isCompleted &&
                      "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)]",
                    isCurrent &&
                      "border-2 border-[var(--accent)] text-[var(--accent)]",
                    !isCurrent &&
                      !isCompleted &&
                      "border border-[var(--border)] text-[var(--text-muted)]"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Step content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[13px] font-medium leading-tight",
                      isCompleted && "text-[var(--text-muted)] line-through decoration-[var(--accent)]/40",
                      isCurrent && "text-[var(--text-main)]",
                      !isCurrent && !isCompleted && "text-[var(--text-muted)]"
                    )}
                  >
                    {step.title}
                  </p>

                  {/* Waiting state for step 2 (entity extraction) */}
                  {isWaiting && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--accent)]"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Extracting entities...</span>
                    </motion.p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[color-mix(in_srgb,var(--border)_30%,transparent)] px-4 py-2.5">
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Complete all steps to unlock the full experience
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
