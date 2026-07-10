"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Hourglass } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WaitlistDialog } from "@/components/shared/waitlist-dialog";
import { useWorkspaceStore } from "@/lib/store";

/**
 * Action labels mapping: internal action keys → human-readable labels.
 */
export const ACTION_LABELS: Record<string, string> = {
  chat_message: "Soul Conversations",
  lore_ingest: "Lore Inscription",
  lore_inscribe: "Lore Inscription",
  consistency_check: "Consistency Checks",
  soul_generate: "Soul Forging",
  soul_forge: "Soul Forging",
  tavern_session: "Tavern Sessions",
  narrator_tool: "Narrator's Eye",
};

/**
 * Calculate hours and minutes remaining until next UTC midnight.
 */
function getTimeUntilReset(): { hours: number; minutes: number; formatted: string } {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const formatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { hours, minutes, formatted };
}

interface RateLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: string;
  limit?: number;
}

export function RateLimitModal({ open, onOpenChange, action, limit }: RateLimitModalProps) {
  const rateLimits = useWorkspaceStore((s) => s.rateLimits);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const label = action
    ? (ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    : "This Action";

  // Resolve current count from the store
  const entry = action ? rateLimits[action] : undefined;
  const currentCount = entry?.count ?? limit ?? 0;
  const maxCount = entry?.limit ?? limit ?? 0;

  const { formatted: resetTime } = getTimeUntilReset();

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--ai-pulse)_12%,transparent)]"
          >
            <Hourglass className="h-6 w-6 text-[var(--accent)]" />
          </motion.div>
          <DialogTitle className="font-heading text-4xl">The inkwell runs dry.</DialogTitle>
          <DialogDescription className="text-base leading-7">
            You have reached today&apos;s limit for{" "}
            <span className="text-foreground">{label}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Usage count display */}
          <div className="flex items-center justify-between rounded-[18px] border border-border bg-[rgba(13,11,8,0.6)] p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-secondary">Usage</p>
              <p className="mt-1 font-heading text-3xl text-[var(--accent)]">
                {currentCount} / {maxCount}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-secondary">Action</p>
              <p className="mt-1 text-sm text-foreground">{label}</p>
            </div>
          </div>

          {/* Reset countdown */}
          <div className="flex items-center justify-between rounded-[18px] border border-border bg-[rgba(13,11,8,0.6)] p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-secondary">Resets in</p>
              <p className="mt-1 font-heading text-3xl text-[rgb(212,168,83)]">{resetTime}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-secondary">At midnight</p>
              <p className="mt-1 text-sm text-secondary">UTC</p>
            </div>
          </div>

          {/* Upgrade prompt */}
          <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] p-4">
            <p className="text-sm leading-6 text-secondary">
              Need more?{" "}
              <button
                type="button"
                onClick={() => setWaitlistOpen(true)}
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Upgrade your plan
              </button>{" "}
              to unlock higher daily limits and uninterrupted worldbuilding.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Return to your world
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} source="rate-limit" />
    </>
  );
}
