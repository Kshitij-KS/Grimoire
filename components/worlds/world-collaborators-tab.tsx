"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Crown,
  Mail,
  Pencil,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { WorldMember, WorldInvitation } from "@/lib/types";

interface WorldCollaboratorsTabProps {
  worldId: string;
  isDemo?: boolean;
}

const ROLE_META = {
  owner: { label: "Owner", icon: Crown, color: "text-[var(--accent)]" },
  editor: { label: "Editor", icon: Pencil, color: "text-[var(--ai-pulse)]" },
  viewer: { label: "Viewer", icon: Shield, color: "text-[var(--text-muted)]" },
} as const;

export function WorldCollaboratorsTab({ worldId, isDemo = false }: WorldCollaboratorsTabProps) {
  const [members, setMembers] = useState<WorldMember[]>([]);
  const [invitations, setInvitations] = useState<WorldInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isDemo) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/worlds/${worldId}/members`);
      if (!res.ok) throw new Error("Failed to load team");
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvitations(data.invitations ?? []);
    } catch {
      toast.error("Could not load team members.");
    } finally {
      setLoading(false);
    }
  }, [worldId, isDemo]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isDemo) return;
    setSending(true);
    try {
      const res = await fetch(`/api/worlds/${worldId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      setInvitations((prev) => [data.invitation, ...prev]);
      setInviteEmail("");
      toast.success("Invitation created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setSending(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/worlds/${worldId}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success("Member removed.");
    } catch {
      toast.error("Failed to remove member.");
    } finally {
      setRemovingId(null);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invitations/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard.");
  };

  if (isDemo) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Users className="h-8 w-8 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">
          Team collaboration is available on real worlds.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner className="h-5 w-5 text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Invite form */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Invite a collaborator</p>
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="collaborator@email.com"
              className="w-full rounded-[10px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] py-2 pl-9 pr-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(["editor", "viewer"] as const).map((r) => {
              const meta = ROLE_META[r];
              const Icon = meta.icon;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setInviteRole(r)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-xs transition-all ${
                    inviteRole === r
                      ? "border-[var(--border-focus)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--text-main)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <Button
            type="submit"
            disabled={!inviteEmail.trim() || sending}
            className="w-full"
            size="sm"
          >
            {sending ? <LoadingSpinner className="mr-2 h-3.5 w-3.5" /> : <UserPlus className="mr-2 h-3.5 w-3.5" />}
            Send Invite
          </Button>
        </form>
        <p className="text-[11px] text-[var(--text-muted)] leading-5">
          <span className="text-[var(--text-main)]">Editor</span> — can write lore and forge souls.{" "}
          <span className="text-[var(--text-main)]">Viewer</span> — read only access.
        </p>
      </div>

      {/* Current members */}
      {members.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Members</p>
          <AnimatePresence>
            {members.map((member) => {
              const role = member.role as keyof typeof ROLE_META;
              const meta = ROLE_META[role] ?? ROLE_META.viewer;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center justify-between rounded-[12px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-xs font-semibold text-[var(--primary)]">
                      {((member.profile?.display_name ?? member.profile?.username ?? "?").slice(0, 1)).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-main)] truncate">
                        {member.profile?.display_name ?? member.profile?.username ?? "Unknown"}
                      </p>
                      <div className={`flex items-center gap-1 text-[10px] ${meta.color}`}>
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.user_id)}
                    disabled={removingId === member.user_id}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] hover:text-[var(--danger)] disabled:opacity-40"
                    title="Remove member"
                  >
                    {removingId === member.user_id ? (
                      <LoadingSpinner className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Pending Invitations</p>
          <AnimatePresence>
            {invitations.map((inv) => {
              const expires = new Date(inv.expires_at);
              const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86400000);
              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center justify-between rounded-[12px] border border-[var(--border)] border-dashed bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-main)] truncate">{inv.invited_email}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {inv.role} · expires in {daysLeft}d
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyInviteLink(inv.token)}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                  >
                    <Copy className="h-3 w-3" />
                    Copy link
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {members.length === 0 && invitations.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Users className="h-6 w-6 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No collaborators yet. Invite someone above.</p>
        </div>
      )}
    </div>
  );
}
