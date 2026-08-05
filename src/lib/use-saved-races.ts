"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The current user's saved races, shared by every page with a save control.
 *
 * Toggling updates optimistically and reverts if the request fails, so the
 * heart never shows a save that didn't actually persist. Saving while logged
 * out sends the user to the login page instead of silently doing nothing.
 */
export function useSavedRaces() {
  const router = useRouter();
  const [savedRaceIds, setSavedRaceIds] = useState<Set<string>>(new Set());
  /** null until the first load resolves. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/user-races")
      .then(async (res) => {
        if (res.status === 401) {
          setSignedIn(false);
          return;
        }
        if (!res.ok) return;
        const data: { raceIds: string[] } = await res.json();
        setSignedIn(true);
        setSavedRaceIds(new Set(data.raceIds));
      })
      .catch(() => {});
  }, []);

  const toggleSaved = useCallback(
    async (raceId: string) => {
      if (signedIn === false) {
        router.push("/login");
        return;
      }

      const wasSaved = savedRaceIds.has(raceId);
      const apply = (saved: boolean) =>
        setSavedRaceIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(raceId);
          else next.delete(raceId);
          return next;
        });

      apply(!wasSaved);
      try {
        const res = wasSaved
          ? await fetch(`/api/user-races?raceId=${encodeURIComponent(raceId)}`, {
              method: "DELETE",
            })
          : await fetch("/api/user-races", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ raceId }),
            });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
      } catch {
        apply(wasSaved);
      }
    },
    [router, savedRaceIds, signedIn],
  );

  return {
    savedRaceIds,
    isSaved: (raceId: string) => savedRaceIds.has(raceId),
    toggleSaved,
  };
}
