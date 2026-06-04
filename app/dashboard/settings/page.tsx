import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { Button } from "@/components/ui/button";
import { SettingsContent } from "@/components/settings/settings-content";
import { getProfile, getSessionUser, getUsageMeters } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/public-env";
import { DAILY_LIMITS } from "@/lib/constants";
import type { UsageMeter } from "@/lib/types";

const USAGE_LABELS: Partial<Record<UsageMeter["action"], string>> = {
  chat_message: "Chat messages",
  lore_ingest: "Lore inscriptions",
  consistency_check: "Consistency checks",
  soul_generate: "Soul forges",
  tavern_message: "Tavern messages",
  narrator_action: "Narrator actions",
  world_export: "World exports",
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

        {/* Tabbed settings content */}
        <SettingsContent
          email={user?.email}
          profile={profile}
          usage={usageRows}
        />
      </div>
    </main>
  );
}
