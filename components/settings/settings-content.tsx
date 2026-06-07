"use client";

import { CreditCard, Gauge, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SettingsLayout,
  type SettingsTabId,
} from "@/components/settings/settings-layout";
import { AccountTab } from "@/components/settings/account-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";
import {
  SettingsSection,
  SettingsGroupLabel,
} from "@/components/settings/settings-primitives";
import { FREE_TIER_LIMITS } from "@/lib/constants";
import type { Profile } from "@/lib/types";

/* ─── Props ─── */

interface UsageRow {
  label: string;
  used: number;
  limit: number;
}

export interface SettingsContentProps {
  email?: string | null;
  profile: Profile | null;
  usage: UsageRow[];
}

/* ─── Usage Tab ─── */

function UsageTab({ usage }: { usage: UsageRow[] }) {
  return (
    <div className="space-y-6">
      <SettingsSection
        icon={Gauge}
        title="Usage & Limits"
        description="Daily ink resets at midnight UTC."
      >
        <SettingsGroupLabel>Today&apos;s Ink</SettingsGroupLabel>
        <div className="space-y-4">
          {usage.map(({ label, used, limit }) => {
            const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
            const barColor =
              pct >= 90 ? "var(--danger)" : pct >= 60 ? "var(--accent)" : "var(--ai-pulse)";
            return (
              <div key={label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-secondary">{label}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">
                    {used} / {limit}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Sparkles}
        title="Free Tier"
        description="What's included on the free plan."
        tone="ai-pulse"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Worlds", value: FREE_TIER_LIMITS.worlds },
            { label: "Souls / world", value: FREE_TIER_LIMITS.soulsPerWorld },
            { label: "Lore entries", value: FREE_TIER_LIMITS.loreEntries },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-5 text-center"
            >
              <p className="font-heading text-3xl text-foreground tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-secondary">{label}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

/* ─── Billing Tab ─── */

function BillingTab({ profile }: { profile: Profile | null }) {
  return (
    <SettingsSection
      icon={CreditCard}
      title="Billing & Plan"
      description="Manage your subscription."
      aside={
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium capitalize text-[var(--text-muted)]">
          {profile?.plan ?? "Free"} plan
        </span>
      }
    >
      <p className="text-sm leading-7 text-secondary">
        You&apos;re on the free plan. Paid tiers with higher limits, more worlds, and priority
        generation are coming.
      </p>
      <div
        className="mt-4 rounded-[14px] border px-4 py-3 text-xs leading-5 text-[var(--accent)]"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
          background: "color-mix(in srgb, var(--accent) 6%, transparent)",
        }}
      >
        Upgrade options will appear here when available.
      </div>
    </SettingsSection>
  );
}

/* ─── Danger Tab ─── */

function DangerTab() {
  return (
    <SettingsSection
      icon={ShieldAlert}
      title="Danger Zone"
      description="Irreversible actions. Proceed with care."
      tone="danger"
    >
      <p className="text-sm leading-7 text-secondary">
        Deleting your account permanently removes all worlds, lore, souls, and conversations.
        This cannot be undone.
      </p>
      <Button
        variant="ghost"
        className="mt-4 w-full border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] sm:w-auto"
        disabled
      >
        Delete account — coming soon
      </Button>
    </SettingsSection>
  );
}

/* ─── Main SettingsContent Component ─── */

export function SettingsContent({ email, profile, usage }: SettingsContentProps) {
  return (
    <SettingsLayout>
      {(activeTab: SettingsTabId) => {
        switch (activeTab) {
          case "account":
            return <AccountTab email={email} profile={profile} />;
          case "preferences":
            return <PreferencesTab />;
          case "usage":
            return <UsageTab usage={usage} />;
          case "billing":
            return <BillingTab profile={profile} />;
          case "danger-zone":
            return <DangerTab />;
          default:
            return <AccountTab email={email} profile={profile} />;
        }
      }}
    </SettingsLayout>
  );
}
