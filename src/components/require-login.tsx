"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
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
  const { user, loaded } = useCurrentUser();

  if (!loaded) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  if (!user) {
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
