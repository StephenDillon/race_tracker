"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogInIcon } from "lucide-react";

/**
 * Gates create pages behind login (see AGENTS.md: create/edit is always
 * RBAC-gated in the UI, not just the API). Renders children only when a
 * session exists; otherwise shows a login prompt.
 */
export function RequireLogin({
  message,
  children,
}: {
  /** e.g. "Log in to add your run club." */
  message: string;
  children: React.ReactNode;
}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: unknown }) => setLoggedIn(!!d.user))
      .catch(() => setLoggedIn(false));
  }, []);

  if (loggedIn === null) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  if (!loggedIn) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-muted-foreground">{message}</p>
            <Button asChild>
              <Link href="/login">
                <LogInIcon className="size-4" />
                Log in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
