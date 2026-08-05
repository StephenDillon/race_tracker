"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/use-current-user";

const links = [
  { href: "/", label: "Home" },
  { href: "/races", label: "Races" },
  { href: "/run-clubs", label: "Run Clubs" },
  // Saved races only mean something once you're signed in.
  { href: "/my-races", label: "My Races", authOnly: true },
  { href: "/world-majors", label: "World Majors" },
];

export function NavTabs() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const visible = links.filter((link) => !link.authOnly || user);

  return (
    <nav className="flex items-center gap-4">
      {visible.map((link) => {
        // "/" only matches itself; section tabs stay active on their subpages.
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-foreground",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
