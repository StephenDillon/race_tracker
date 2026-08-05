"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string;
  role?: Role;
}

/**
 * The signed-in user, shared by every client component that needs it.
 *
 * `/api/auth/me` is fetched once per navigation and the result is broadcast to
 * all subscribers, so the header, nav tabs, and page bodies don't each fire
 * their own request. `user` is `null` when signed out and `undefined` until
 * the first response lands — components that render differently for the two
 * states should wait for `loaded`.
 */
let cachedUser: CurrentUser | null | undefined;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<(user: CurrentUser | null) => void>();

function fetchCurrentUser(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = fetch("/api/auth/me")
    .then((r) => (r.ok ? r.json() : { user: null }))
    .then((d: { user: CurrentUser | null }) => {
      cachedUser = d.user ?? null;
    })
    .catch(() => {
      cachedUser = null;
    })
    .finally(() => {
      inFlight = null;
      subscribers.forEach((notify) => notify(cachedUser ?? null));
    });

  return inFlight;
}

/** Drop the cached user and re-fetch — call after login/logout. */
export function refreshCurrentUser(): Promise<void> {
  cachedUser = undefined;
  return fetchCurrentUser();
}

export function useCurrentUser(): {
  user: CurrentUser | null | undefined;
  loaded: boolean;
} {
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null | undefined>(cachedUser);

  useEffect(() => {
    subscribers.add(setUser);
    // A navigation may have followed a login or logout, so re-check rather
    // than trusting a cache from the previous page.
    refreshCurrentUser();
    return () => {
      subscribers.delete(setUser);
    };
  }, [pathname]);

  return { user, loaded: user !== undefined };
}
