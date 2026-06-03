"use client";

import { AlertTriangle } from "lucide-react";
import { isNearLimit, remainingUses } from "@/lib/hooks/use-rate-limit-status";

interface RateLimitWarningProps {
  /** Current usage count for this action */
  count: number;
  /** Maximum daily limit for this action */
  limit: number;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Inline badge showing "X left today" when usage reaches >= 80% of the daily limit.
 * Designed to be placed adjacent to action buttons in the workspace.
 */
export function RateLimitWarning({ count, limit, className = "" }: RateLimitWarningProps) {
  if (!isNearLimit(count, limit)) return null;

  const remaining = remainingUses(count, limit);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--accent)] ${className}`}
      role="status"
      aria-label={`${remaining} uses left today`}
    >
      <AlertTriangle className="h-3 w-3" />
      <span>{remaining} left today</span>
    </span>
  );
}
