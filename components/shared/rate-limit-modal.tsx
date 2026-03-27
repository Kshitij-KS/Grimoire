"use client";

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

interface RateLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: string;
  limit?: number;
}

const actionLabels: Record<string, string> = {
  chat_message: "soul conversations",
  lore_ingest: "lore ingestion",
  consistency_check: "consistency checks",
  soul_generate: "soul generation",
};

export function RateLimitModal({ open, onOpenChange, action, limit }: RateLimitModalProps) {
  const label = action ? (actionLabels[action] ?? action.replace("_", " ")) : "this action";

  const resetTime = (() => {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const diff = midnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(212,168,83,0.22)] bg-[rgba(124,92,191,0.12)]"
          >
            <Hourglass className="h-6 w-6 text-[rgb(212,168,83)]" />
          </motion.div>
          <DialogTitle className="font-heading text-4xl">The inkwell runs dry.</DialogTitle>
          <DialogDescription className="text-base leading-7">
            You have reached today&apos;s limit for{" "}
            <span className="text-foreground">{label}</span>.
            {limit ? ` The daily allowance is ${limit}.` : null}{" "}
            The ink replenishes at midnight.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <p className="text-sm leading-7 text-secondary">
            Grimoire keeps free worlds generous, but heavier magic stays measured.
            Every drop of ink counts. Return tomorrow when the archive has rested.
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Return to your world
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
