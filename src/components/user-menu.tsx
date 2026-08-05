"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { refreshCurrentUser, useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOutIcon, SettingsIcon, ShieldIcon, UserIcon } from "lucide-react";

export function UserMenu() {
  const router = useRouter();
  const { user, loaded } = useCurrentUser();

  if (!loaded) return null;

  if (!user) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href="/login">Log in</Link>
      </Button>
    );
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Refresh the shared user so the nav tabs drop signed-in-only entries too.
    await refreshCurrentUser();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <Button size="sm" asChild>
        <Link href="/submit">Submit a race</Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <UserIcon className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-sm font-medium truncate">
            {user.email}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="gap-2">
              <SettingsIcon className="size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          {user.role === "admin" && (
            <DropdownMenuItem asChild>
              <Link href="/admin/users" className="gap-2">
                <ShieldIcon className="size-4" />
                Manage users
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={handleLogout} className="gap-2">
            <LogOutIcon className="size-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
