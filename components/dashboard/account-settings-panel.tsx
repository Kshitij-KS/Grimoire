"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, Mail, Shield, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/lib/types";
import { initialsFromName } from "@/lib/utils";

interface AccountSettingsPanelProps {
  email?: string | null;
  profile?: Profile | null;
}

export function AccountSettingsPanel({ email, profile }: AccountSettingsPanelProps) {
  const supabase = createClient();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [emailDraft, setEmailDraft] = useState(email ?? "");
  const [passwordDraft, setPasswordDraft] = useState("");

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const handleEmailUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = emailDraft.trim();
    if (!nextEmail || nextEmail === email) return;

    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      toast.success("A verification email has been sent to the new address.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordDraft.trim().length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordDraft });
      if (error) throw error;
      setPasswordDraft("");
      toast.success("Password updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const displayName = profile?.display_name?.trim() || email?.split("@")[0] || "Archivist";
  const avatarInitials = initialsFromName(displayName);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card id="profile" className="rounded-[32px] p-6 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="chapter-label">Account • Profile</p>
            <h1 className="font-heading text-4xl text-foreground">Account settings</h1>
            <p className="max-w-2xl text-sm leading-7 text-secondary">
              Manage your sign-in details, refresh your credentials, and jump back into the archive.
            </p>
          </div>

          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-[rgba(126,109,242,0.12)] text-xl font-heading text-[var(--violet-soft)]">
            {avatarInitials}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-secondary">
              <UserCircle2 className="h-4 w-4" />
              Display name
            </div>
            <p className="mt-3 text-lg text-foreground">{displayName}</p>
            <p className="mt-1 text-sm text-secondary">{email || "No email found"}</p>
          </div>

          <div className="rounded-[24px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-secondary">
              <Shield className="h-4 w-4" />
              Plan
            </div>
            <p className="mt-3 text-lg text-foreground capitalize">{profile?.plan ?? "free"} plan</p>
            <p className="mt-1 text-sm text-secondary">Account access is handled through Supabase Auth.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          <Card className="rounded-[28px] border border-border bg-[rgba(255,255,255,0.02)] p-5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[var(--gold)]" />
              <h2 className="font-heading text-2xl text-foreground">Update email</h2>
            </div>
            <form className="mt-4 space-y-4" onSubmit={handleEmailUpdate}>
              <Input
                type="email"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                placeholder="scribe@ashveil.com"
              />
              <p className="text-xs leading-6 text-secondary">
                Supabase will send a confirmation email before the change takes effect.
              </p>
              <Button type="submit" disabled={savingEmail || !emailDraft.trim() || emailDraft.trim() === email}>
                {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save email
              </Button>
            </form>
          </Card>

          <Card className="rounded-[28px] border border-border bg-[rgba(255,255,255,0.02)] p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[var(--violet-soft)]" />
              <h2 className="font-heading text-2xl text-foreground">Update password</h2>
            </div>
            <form className="mt-4 space-y-4" onSubmit={handlePasswordUpdate}>
              <Input
                type="password"
                value={passwordDraft}
                onChange={(event) => setPasswordDraft(event.target.value)}
                placeholder="New password"
              />
              <p className="text-xs leading-6 text-secondary">
                Password changes are handled directly by Supabase Auth and take effect immediately.
              </p>
              <Button type="submit" disabled={savingPassword || passwordDraft.trim().length < 8}>
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save password
              </Button>
            </form>
          </Card>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-[32px] p-6">
          <p className="chapter-label">Session</p>
          <h2 className="mt-2 font-heading text-3xl text-foreground">Leave the archive</h2>
          <p className="mt-3 text-sm leading-7 text-secondary">
            Sign out when you’re done. Your session will close cleanly and return you to the entrance page.
          </p>
          <Button className="mt-5 w-full" variant="secondary" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            Sign out
          </Button>
        </Card>

        <Card className="rounded-[32px] border-[rgba(196,168,106,0.24)] bg-[rgba(196,168,106,0.06)] p-6">
          <p className="chapter-label">Notes</p>
          <h2 className="mt-2 font-heading text-2xl text-foreground">Account safety</h2>
          <p className="mt-3 text-sm leading-7 text-secondary">
            If you need deeper identity management later, we can expand this page with password reset, email verification
            status, or account deletion flows without changing the navigation again.
          </p>
        </Card>
      </div>
    </div>
  );
}
