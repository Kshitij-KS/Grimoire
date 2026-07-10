"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { isValidWaitlistEmail } from "@/lib/waitlist";

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which CTA opened the dialog — recorded alongside the email. */
  source?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Email-capture dialog opened by the "Upgrade to Pro" CTAs. Posts to
 * `/api/waitlist` and shows inline validation plus success/error states.
 *
 * Race/DOM care:
 *  - `status === "submitting"` disables the submit button and short-circuits
 *    `handleSubmit`, guarding against double-submit; it is always reset in the
 *    `finally` block so a failed request re-enables the form.
 *  - a `mounted` ref prevents any `setState` after the dialog unmounts mid-flight
 *    (e.g. the user closes it while the request is in flight).
 */
export function WaitlistDialog({ open, onOpenChange, source }: WaitlistDialogProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset transient state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setMessage(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "submitting") return; // guard double-submit

    const trimmed = email.trim();
    if (!isValidWaitlistEmail(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
      });

      if (!mountedRef.current) return;

      if (res.ok) {
        setStatus("success");
        setMessage("You're on the list. We'll be in touch.");
      } else {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      if (!mountedRef.current) return;
      setStatus("error");
      setMessage("Network error. Please try again.");
    } finally {
      if (mountedRef.current) {
        setStatus((prev) => (prev === "submitting" ? "idle" : prev));
      }
    }
  };

  const submitting = status === "submitting";
  const succeeded = status === "success";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]">
            {succeeded ? (
              <Check className="h-6 w-6 text-[var(--accent)]" />
            ) : (
              <Sparkles className="h-6 w-6 text-[var(--accent)]" />
            )}
          </div>
          <DialogTitle className="font-heading text-4xl">
            {succeeded ? "You're on the list." : "Join the Pro waitlist."}
          </DialogTitle>
          <DialogDescription className="text-base leading-7">
            {succeeded
              ? "Thanks for your interest — we'll email you when Pro is ready."
              : "Grimoire Pro is coming soon. Leave your email and we'll let you know the moment higher limits and premium worldbuilding tools go live."}
          </DialogDescription>
        </DialogHeader>

        {!succeeded && (
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="waitlist-email" className="text-xs uppercase tracking-widest text-secondary">
                Email
              </label>
              <input
                id="waitlist-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") {
                    setStatus("idle");
                    setMessage(null);
                  }
                }}
                placeholder="you@example.com"
                disabled={submitting}
                aria-invalid={status === "error"}
                className="w-full rounded-[12px] border border-border bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-3 py-2.5 text-sm text-foreground placeholder:text-dim focus:border-[var(--border-focus)] focus:outline-none transition-colors disabled:opacity-50"
              />
              {status === "error" && message && (
                <p className="text-xs text-[var(--danger)]" role="alert">
                  {message}
                </p>
              )}
            </div>

            <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  Joining…
                </>
              ) : (
                "Join the waitlist"
              )}
            </Button>
          </form>
        )}

        {succeeded && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
