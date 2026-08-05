"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCountdown, formatDate } from "@/lib/format";
import { useSavedRaces } from "@/lib/use-saved-races";
import type { Race } from "@/lib/types";
import { ExternalLinkIcon, HeartIcon } from "lucide-react";

function isPast(iso: string): boolean {
  return new Date(`${iso}T23:59:59`) < new Date();
}

/**
 * Abbott World Marathon Majors, driven entirely by the race database:
 * every upcoming race tagged "World Major", with its entry methods.
 * Facts are corrected via the race edit page, not code changes.
 */
export default function WorldMajorsPage() {
  const [majors, setMajors] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSaved, toggleSaved } = useSavedRaces();

  useEffect(() => {
    fetch(`/api/races?tags=${encodeURIComponent("World Major")}&limit=100`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: { races: Race[] } = await res.json();
        // The API already returns upcoming races sorted by date.
        setMajors(data.races);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load majors"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Abbott World Marathon Majors</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming majors with qualifying methods and entry deadlines
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-5">
          {majors.map((race) => {
            const saved = isSaved(race.id);
            return (
              <Card key={race.id}>
                <CardContent className="flex flex-col gap-4 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSaved(race.id)}
                        className="mt-1 text-muted-foreground hover:text-primary"
                        aria-label={
                          saved
                            ? `Remove ${race.name} from my races`
                            : `Add ${race.name} to my races`
                        }
                      >
                        <HeartIcon
                          className={`size-5 ${saved ? "fill-primary text-primary" : ""}`}
                        />
                      </button>
                      <div>
                        <h2 className="text-xl font-bold">
                          {race.website ? (
                            <a
                              href={race.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                            >
                              {race.name}
                              <ExternalLinkIcon className="size-4" />
                            </a>
                          ) : (
                            <Link
                              href={`/races/${encodeURIComponent(race.id)}`}
                              className="hover:text-primary hover:underline"
                            >
                              {race.name}
                            </Link>
                          )}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          <Link
                            href={`/races/${encodeURIComponent(race.id)}`}
                            className="hover:text-primary hover:underline"
                          >
                            {race.city}, {race.country}
                          </Link>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm">{formatDate(race.date)}</div>
                      <div className="text-lg font-bold tracking-tight">
                        {formatCountdown(race.date)}
                      </div>
                    </div>
                  </div>

                  {race.entryMethods.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col className="w-[40%]" />
                          <col className="w-[20%]" />
                          <col className="w-[20%]" />
                          <col className="w-[20%]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-3 py-2 text-left font-medium">Entry Method</th>
                            <th className="px-3 py-2 text-left font-medium">Opens</th>
                            <th className="px-3 py-2 text-left font-medium">Closes</th>
                            <th className="px-3 py-2 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {race.entryMethods.map((entry) => {
                            const opensPast = isPast(entry.opens);
                            const closesPast = isPast(entry.closes);
                            return (
                              <tr key={entry.method} className="border-b last:border-0">
                                <td className={`px-3 py-2 font-medium ${closesPast ? "text-muted-foreground line-through" : ""}`}>
                                  {entry.method}
                                </td>
                                <td className={`px-3 py-2 font-mono ${opensPast ? "text-muted-foreground line-through" : ""}`}>
                                  {formatDate(entry.opens)}
                                </td>
                                <td className={`px-3 py-2 font-mono ${closesPast ? "text-muted-foreground line-through" : ""}`}>
                                  {formatDate(entry.closes)}
                                </td>
                                <td className="px-3 py-2">
                                  {closesPast ? (
                                    <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                      Closed
                                    </Badge>
                                  ) : opensPast ? (
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                      Open now
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                                      Upcoming
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {majors.length === 0 && !error && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming races are tagged “World Major”.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
