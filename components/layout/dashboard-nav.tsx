import Link from "next/link";
import { GrimoireLogo } from "@/components/shared/grimoire-logo";
import { Button } from "@/components/ui/button";

export function DashboardNav({ isAuthed }: { isAuthed: boolean }) {
  return (
    <header className="border-b border-border backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href={isAuthed ? "/dashboard" : "/"}>
          <GrimoireLogo />
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/demo">Demo World</Link>
          </Button>
          <Button asChild>
            <Link href={isAuthed ? "/dashboard" : "/auth"}>{isAuthed ? "Workspace" : "Sign In"}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
