"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Mail, ShieldCheck, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection, SettingsGroupLabel } from "@/components/settings/settings-primitives";
import type { Profile } from "@/lib/types";
import { initialsFromName } from "@/lib/utils";

interface AccountTabProps {
  email?: string | null;
  profile?: Profile | null;
}

export function AccountTab({ email, profile }: AccountTabProps) {
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
    <div className="space-y-6">
      {/* Identity */}
      <SettingsSection
        icon={UserCircle2}
        title="Profile"
        description="Your identity within the archive."
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--border)] font-heading text-2xl text-[var(--accent)]"
            style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
          >
            {avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-2xl text-foreground">{displayName}</p>
            <p className="mt-0.5 truncate text-sm text-secondary">{email || "No email found"}</p>
          </div>
          <div className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium capitalize text-[var(--text-muted)]">
            {profile?.plan ?? "free"} plan
          </div>
        </div>
      </SettingsSection>

      {/* Credentials */}
      <SettingsSection
        icon={Mail}
        title="Credentials"
        description="Update your sign-in email and password."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {/* Email */}
          <form className="space-y-3" onSubmit={handleEmailUpdate}>
            <SettingsGroupLabel>Email address</SettingsGroupLabel>
            <Input
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
              placeholder="scribe@ashveil.com"
            />
            <p className="text-xs leading-5 text-secondary">
              A confirmation email is sent before the change takes effect.
            </p>
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={savingEmail || !emailDraft.trim() || emailDraft.trim() === email}
            >
              {savingEmail ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
              Save email
            </Button>
          </form>

          {/* Password */}
          <form className="space-y-3" onSubmit={handlePasswordUpdate}>
            <SettingsGroupLabel>Password</SettingsGroupLabel>
            <Input
              type="password"
              value={passwordDraft}
              onChange={(event) => setPasswordDraft(event.target.value)}
              placeholder="New password"
            />
            <p className="text-xs leading-5 text-secondary">
              At least 8 characters. Applies immediately after saving.
            </p>
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={savingPassword || passwordDraft.trim().length < 8}
            >
              {savingPassword ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
              Save password
            </Button>
          </form>
        </div>

        <div
          className="mt-5 flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-xs leading-5 text-[var(--text-muted)]"
          style={{ background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span>
            Changes are handled securely via Supabase Auth — no passwords are ever stored in
            plain text.
          </span>
        </div>
      </SettingsSection>

      {/* Session */}
      <SettingsSection
        icon={LogOut}
        title="Session"
        description="Close your session and return to the entrance."
        tone="ai-pulse"
      >
        <Button
          className="w-full sm:w-auto"
          variant="secondary"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <LoadingSpinner className="mr-2 h-4 w-4" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          Sign out
        </Button>
      </SettingsSection>
    </div>
  );
}
