"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, BookOpen, CheckCircle2, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type InvitationState =
  | { status: "loading" }
  | { status: "valid"; worldName: string; worldId: string; role: string; invitedEmail: string }
  | { status: "accepting" }
  | { status: "accepted"; worldId: string; worldName: string }
  | { status: "error"; message: string };

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<InvitationState>({ status: "loading" });

  const loadInvitation = useCallback(async () => {
    try {
      const res = await fetch(`/api/invitations/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "This invitation is no longer valid." });
        return;
      }

      const inv = data.invitation;
      setState({
        status: "valid",
        worldName: inv.world?.name ?? "a world",
        worldId: inv.world?.id ?? inv.world_id,
        role: inv.role,
        invitedEmail: inv.invited_email,
      });
    } catch {
      setState({ status: "error", message: "Failed to load invitation. Please try again." });
    }
  }, [token]);

  useEffect(() => { loadInvitation(); }, [loadInvitation]);

  const handleAccept = async () => {
    if (state.status !== "valid") return;
    const { worldName, worldId } = state;
    setState({ status: "accepting" });

    try {
      const res = await fetch(`/api/invitations/${token}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Failed to accept invitation." });
        return;
      }

      setState({ status: "accepted", worldId: data.worldId ?? worldId, worldName });
      setTimeout(() => { router.push(`/worlds/${data.worldId ?? worldId}`); }, 1800);
    } catch {
      setState({ status: "error", message: "Failed to accept invitation. Please try again." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_srgb,var(--primary)_8%,transparent),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel-elevated relative w-full max-w-md rounded-[32px] p-8"
      >
        {/* Logo mark */}
        <div className="mb-6 flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-[var(--accent)]" />
          <span className="font-heading text-xl text-[var(--text-main)]">Grimoire</span>
        </div>

        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">Validating invitation…</p>
          </div>
        )}

        {state.status === "valid" && (
          <div className="space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]">
              <Users className="h-6 w-6 text-[var(--primary)]" />
            </div>

            <div>
              <h1 className="font-heading text-3xl text-[var(--text-main)]">You&apos;re invited</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                You&apos;ve been invited to collaborate on{" "}
                <span className="text-[var(--text-main)]">{state.worldName}</span>{" "}
                as a{" "}
                <span className="text-[var(--accent)] capitalize">{state.role}</span>.
              </p>
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Invited as</p>
              <p className="text-sm text-[var(--text-main)]">{state.invitedEmail}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <Button onClick={handleAccept} className="w-full">
                Join {state.worldName}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </div>
        )}

        {state.status === "accepting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-muted)]">Joining world…</p>
          </div>
        )}

        {state.status === "accepted" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success,#4caf50)_15%,transparent)]">
              <CheckCircle2 className="h-7 w-7 text-[var(--success,#4caf50)]" />
            </div>
            <div>
              <p className="font-heading text-2xl text-[var(--text-main)]">Welcome aboard</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Redirecting to {state.worldName}…
              </p>
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]">
              <AlertCircle className="h-6 w-6 text-[var(--danger)]" />
            </div>
            <div>
              <h1 className="font-heading text-2xl text-[var(--text-main)]">Invalid invitation</h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{state.message}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
