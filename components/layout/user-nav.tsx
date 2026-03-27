"use client";

import Link from "next/link";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CreditCard, LogOut, Settings, User } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function UserNav({ email }: { email?: string }) {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const initial = email ? email.charAt(0).toUpperCase() : "U";

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button className="relative h-8 w-8 rounded-full outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--violet)] focus-visible:ring-offset-2">
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-[rgba(126,109,242,0.15)] text-[var(--violet-soft)] text-xs font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[220px] overflow-hidden rounded-[16px] border border-border bg-[rgba(15,18,25,0.95)] p-1 text-foreground shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          align="end"
          sideOffset={8}
        >
          <div className="px-3 py-2.5">
            <p className="text-xs font-medium text-secondary">Signed in as</p>
            <p className="truncate text-sm font-medium text-foreground">
              {email || "User"}
            </p>
          </div>
          <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
          <DropdownMenu.Item asChild className="relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors focus:bg-[rgba(255,255,255,0.06)] focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <Link href="/dashboard/settings">
              <User className="h-4 w-4 text-secondary" />
              <span>Profile</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors focus:bg-[rgba(255,255,255,0.06)] focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <Link href="/dashboard/settings">
              <Settings className="h-4 w-4 text-secondary" />
              <span>Account Settings</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors focus:bg-[rgba(255,255,255,0.06)] focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <Link href="/dashboard/settings#billing">
              <CreditCard className="h-4 w-4 text-secondary" />
              <span>Billing & Plan</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
          <DropdownMenu.Item
            onClick={handleSignOut}
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-[rgb(212,168,83)] outline-none transition-colors focus:bg-[rgba(212,168,83,0.15)] focus:text-[rgb(212,168,83)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
