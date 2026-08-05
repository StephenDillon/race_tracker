"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Race } from "@/lib/types";
import { formatCountdown, formatDate, formatDistances } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { HeartIcon } from "lucide-react";

export default function MyRacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyRaces = useCallback(async () => {
    try {
      const res = await fetch("/api/user-races");
      if (!res.ok) return;
      const data: { races: Race[] } = await res.json();
      setRaces(data.races);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRaces();
  }, [fetchMyRaces]);

  const removeRace = async (raceId: string) => {
    setRaces((prev) => prev.filter((r) => r.id !== raceId));
    await fetch(`/api/user-races?raceId=${encodeURIComponent(raceId)}`, {
      method: "DELETE",
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading…</p>
      ) : races.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No saved races yet. Click the heart icon on any race to add it here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {races.map((race) => (
            <Card key={race.id} className="relative">
              <button
                type="button"
                onClick={() => removeRace(race.id)}
                className="absolute right-3 top-3 text-primary hover:text-primary/70"
                aria-label="Remove from my races"
              >
                <HeartIcon className="size-5 fill-primary" />
              </button>
              <CardContent className="flex flex-col gap-2 pt-4">
                <h3 className="font-semibold pr-8">
                  <Link
                    href={`/races/${encodeURIComponent(race.id)}`}
                    className="hover:text-primary hover:underline"
                  >
                    {race.name}
                  </Link>
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{formatDistances(race.distances)}</span>
                  <span>{race.city}, {race.country}</span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="font-mono text-sm">{formatDate(race.date)}</span>
                  <span className="text-lg font-bold tracking-tight">
                    {formatCountdown(race.date)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
