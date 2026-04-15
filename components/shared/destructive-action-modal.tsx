"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DestructiveActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  requireString?: string;
  onConfirm: () => Promise<void>;
  isDemo?: boolean;
}

export function DestructiveActionModal({
  open,
  onOpenChange,
  title,
  description,
  requireString,
  onConfirm,
  isDemo = false,
}: DestructiveActionModalProps) {
  const [confirmValue, setConfirmValue] = useState("");
  const [loading, setLoading] = useState(false);

  // Close helper wrapper
  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setTimeout(() => setConfirmValue(""), 200);
    }
  };

  const handleAction = async () => {
    if (isDemo) return;
    setLoading(true);
    try {
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      if (document.body) {
        setLoading(false);
      }
    }
  };

  const disabled = 
    loading || 
    isDemo || 
    (requireString ? confirmValue !== requireString : false);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-12 sm:p-6 drop-shadow-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-panel w-full max-w-md overflow-hidden rounded-[32px] border-[var(--danger)]/20 bg-[var(--surface)] shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-6">
                <div className="flex flex-col gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]">
                    <AlertCircle className="h-5 w-5 text-[var(--danger)]" />
                  </div>
                  <h2 className="mt-2 font-heading text-2xl text-[var(--danger)]">{title}</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="rounded-xl p-2 text-secondary transition hover:bg-[var(--danger)]/10 hover:text-[var(--text-main)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-sm leading-6 text-secondary">{description}</p>
                <p className="mt-4 text-sm font-medium text-[var(--danger)]">
                  This action cannot be undone.
                </p>

                {isDemo && (
                  <div className="mt-4 rounded-xl border border-[rgba(196,168,106,0.3)] bg-[rgba(196,168,106,0.08)] p-3 text-xs text-[var(--gold)]">
                    Destructive actions are disabled in the demo workspace.
                  </div>
                )}

                {requireString && !isDemo && (
                  <div className="mt-6 space-y-2">
                    <label className="text-xs uppercase tracking-widest text-secondary">
                      Type <strong className="text-foreground">{requireString}</strong> to confirm
                    </label>
                    <input
                      value={confirmValue}
                      onChange={(e) => setConfirmValue(e.target.value)}
                      className="w-full rounded-xl border border-[var(--danger)]/20 bg-[var(--bg)]/80 px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--danger)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--danger)]/50 transition-all font-mono"
                      placeholder={requireString}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[var(--danger)]/10 bg-[var(--bg)]/50 p-6">
                <Button variant="ghost" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] hover:text-[var(--danger)]"
                  onClick={handleAction}
                  disabled={disabled}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
