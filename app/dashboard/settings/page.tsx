import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CreditCard, ShieldAlert } from "lucide-react";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { AccountSettingsPanel } from "@/components/dashboard/account-settings-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProfile, getSessionUser } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/env";

export default async function DashboardSettingsPage() {
  const user = await getSessionUser();

  if (hasSupabaseEnv() && !user) {
    redirect("/auth");
  }

  const profile = user ? await getProfile() : null;

  return (
    <main className="page-fade min-h-screen">
      <DashboardNav isAuthed={Boolean(user)} userEmail={user?.email} />
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <p className="chapter-label">Account • Settings</p>
            <h1 className="font-heading text-5xl text-foreground">Keep your archive in your hands.</h1>
            <p className="max-w-2xl text-sm leading-7 text-secondary">
              The dead account menu now leads somewhere real. Identity updates live here, and anything still blocked is
              called out explicitly instead of being left as silent UI chrome.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <AccountSettingsPanel email={user?.email} profile={profile} />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card id="billing" className="rounded-[32px] p-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-[rgb(157,127,224)]" />
              <h2 className="font-heading text-3xl text-foreground">Billing & Plan</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-secondary">
              Billing upgrades are still intentionally blocked in this repo. The app now routes here instead of to a
              dead button, but checkout should remain disabled until a real provider flow is wired end to end.
            </p>
            <div className="mt-4 rounded-[20px] border border-[rgba(212,168,83,0.22)] bg-[rgba(212,168,83,0.07)] p-4 text-sm text-[rgb(240,220,160)]">
              Current plan: <span className="capitalize">{profile?.plan ?? "free"}</span>. Upgrade CTA intentionally
              redirects here as a documented blocker.
            </div>
          </Card>

          <Card className="rounded-[32px] p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-[rgb(192,74,74)]" />
              <h2 className="font-heading text-3xl text-foreground">Account Lifecycle</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-secondary">
              Full account deletion is still blocked until a dedicated audited cascade exists for worlds, lore, chats,
              and generated data. It is documented here instead of being exposed as an unsafe partial action.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
