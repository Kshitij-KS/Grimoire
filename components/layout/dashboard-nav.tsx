import Link from "next/link";
import { GrimoireLogo } from "@/components/shared/grimoire-logo";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/layout/user-nav";

export function DashboardNav({ isAuthed, userEmail }: { isAuthed: boolean, userEmail?: string }) {
  return (
    <header className="border-b border-border backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href={isAuthed ? "/dashboard" : "/"}>
          <GrimoireLogo />
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/demo">Demo</Link>
          </Button>
          {!isAuthed ? (
            <Button asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="secondary">
                <Link href="/dashboard">Workspace</Link>
              </Button>
              <div className="ml-2 pl-2 border-l border-border h-8 flex items-center">
                <UserNav email={userEmail} />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
