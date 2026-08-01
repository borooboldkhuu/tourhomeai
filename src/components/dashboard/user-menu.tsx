"use client";

import { LogOut, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserProfile } from "@/types/database.types";

export function UserMenu({ profile }: { profile: UserProfile }) {
  const initials = (profile.full_name ?? profile.email).slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="h-9 w-9 border border-border">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium text-foreground">{profile.full_name ?? "Зуучлагч"}</div>
          <div className="truncate font-normal">{profile.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <SettingsIcon /> Тохиргоо
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOut} className="w-full">
            <button type="submit" className="flex w-full items-center gap-2 text-left">
              <LogOut className="h-4 w-4" /> Гарах
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
