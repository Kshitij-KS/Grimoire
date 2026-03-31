import Link from "next/link";
import { GrimoireLogo } from "@/components/shared/grimoire-logo";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/layout/user-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function DashboardNav({ isAuthed, userEmail }: { isAuthed: boolean, userEmail?: string }) {
  return (
    <header className="relative border-b border-[var(--border)] bg-[var(--bg)] backdrop-blur-sm">
      {/* Gradient top stripe — re-colored to accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--accent)_25%,transparent)] to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href={isAuthed ? "/dashboard" : "/"}>
          <GrimoireLogo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/demo">Explore Ashveil</Link>
          </Button>
          {!isAuthed ? (
            <Button asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/dashboard">Workspace</Link>
              </Button>
              <div className="ml-2 pl-2 border-l border-[var(--border)] h-8 flex items-center">
                <UserNav email={userEmail} />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
