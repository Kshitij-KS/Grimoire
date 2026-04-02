import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Gauge,
  Palette,
  ShieldAlert,
} from "lucide-react";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { AccountSettingsPanel } from "@/components/dashboard/account-settings-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getProfile, getSessionUser, getUsageMeters } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/env";
import { FREE_TIER_LIMITS, DAILY_LIMITS } from "@/lib/constants";
import type { UsageMeter } from "@/lib/types";

const USAGE_LABELS: Partial<Record<UsageMeter["action"], string>> = {
  chat_message: "Chat messages",
  lore_ingest: "Lore inscriptions",
  consistency_check: "Consistency checks",
  soul_generate: "Soul forges",
};

export default async function DashboardSettingsPage() {
  const user = await getSessionUser();

  if (hasSupabaseEnv() && !user) {
    redirect("/auth");
  }

  const [profile, usage] = await Promise.all([
    user ? getProfile() : null,
    user ? getUsageMeters(user.id) : ([] as UsageMeter[]),
  ]);

  const usageRows = (Object.keys(USAGE_LABELS) as UsageMeter["action"][]).map((action) => {
    const meter = (usage ?? []).find((m) => m.action === action);
    return {
      label: USAGE_LABELS[action]!,
      used: meter?.count ?? 0,
      limit: meter?.limit ?? DAILY_LIMITS[action],
    };
  });

  return (
    <main className="page-fade min-h-screen">
      <DashboardNav isAuthed={Boolean(user)} userEmail={user?.email} />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">

        {/* Page header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="chapter-label">Settings</p>
            <h1 className="mt-2 font-heading text-5xl text-foreground">Your Archive</h1>
            <p className="mt-2 max-w-md text-sm leading-7 text-secondary">
              Manage your account, review usage, and adjust how Grimoire feels.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0 self-start">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        {/* Account identity + credentials */}
        <AccountSettingsPanel email={user?.email} profile={profile} />

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Usage & Limits */}
          <Card className="rounded-[32px] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
                <Gauge className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="font-heading text-2xl text-foreground">Usage & Limits</h2>
                <p className="text-xs text-secondary">Daily ink resets at midnight UTC</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Daily rate limits */}
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
                  Today&apos;s Ink
                </p>
                <div className="space-y-3">
                  {usageRows.map(({ label, used, limit }) => {
                    const pct = Math.min((used / limit) * 100, 100);
                    return (
                      <div key={label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-secondary">{label}</span>
                          <span className="tabular-nums text-[var(--text-muted)]">
                            {used} / {limit}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background:
                                pct >= 90
                                  ? "var(--danger)"
                                  : pct >= 60
                                    ? "var(--accent)"
                                    : "var(--ai-pulse)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Free tier caps */}
              <div className="border-t border-[var(--border)] pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
                  Free Tier Limits
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Worlds", value: FREE_TIER_LIMITS.worlds },
                    { label: "Souls / world", value: FREE_TIER_LIMITS.soulsPerWorld },
                    { label: "Lore entries", value: FREE_TIER_LIMITS.loreEntries },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-center"
                    >
                      <p className="font-heading text-xl text-foreground">{value}</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-secondary">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Preferences */}
          <Card className="rounded-[32px] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--ai-pulse)_12%,transparent)]">
                <Palette className="h-4 w-4 text-[var(--ai-pulse)]" />
              </div>
              <h2 className="font-heading text-2xl text-foreground">Preferences</h2>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-[18px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Appearance</p>
                  <p className="mt-0.5 text-xs text-secondary">
                    Dark parchment or illuminated manuscript
                  </p>
                </div>
                <ThemeToggle />
              </div>

              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3.5 opacity-50">
                <p className="text-sm font-medium text-foreground">Ambient audio</p>
                <p className="mt-0.5 text-xs text-secondary">
                  Toggle dark fantasy atmosphere from the world sidebar
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Billing */}
          <Card id="billing" className="rounded-[32px] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]">
                <CreditCard className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="font-heading text-2xl text-foreground">Billing & Plan</h2>
                <p className="text-xs text-secondary capitalize">{profile?.plan ?? "Free"} plan</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-secondary">
              You&apos;re on the free plan. Paid tiers with higher limits, more worlds, and priority generation are coming.
            </p>
            <div className="mt-4 rounded-[16px] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-3 text-xs text-[var(--accent)]">
              Upgrade options will appear here when available.
            </div>
          </Card>

          {/* Danger zone */}
          <Card className="rounded-[32px] border-[color-mix(in_srgb,var(--danger)_20%,transparent)] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]">
                <ShieldAlert className="h-4 w-4 text-[var(--danger)]" />
              </div>
              <h2 className="font-heading text-2xl text-foreground">Danger Zone</h2>
            </div>
            <p className="mt-4 text-sm leading-7 text-secondary">
              Deleting your account permanently removes all worlds, lore, souls, and conversations. This cannot be undone.
            </p>
            <Button
              variant="ghost"
              className="mt-4 w-full border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
              disabled
            >
              Delete account — coming soon
            </Button>
          </Card>
        </div>
      </div>
    </main>
  );
}
