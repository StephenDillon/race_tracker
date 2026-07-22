"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Races" },
  { href: "/my-races", label: "My Races" },
  { href: "/world-majors", label: "World Majors" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-foreground",
            pathname === link.href
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
