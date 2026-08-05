"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { RunClub } from "@/lib/types";
import { formatClubRunSchedule } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLinkIcon, MapPinIcon, PlusIcon } from "lucide-react";

const PAGE_SIZE = 25;

/** Compact schedule summary for the table: first two runs, then "+N more". */
function ScheduleSummary({ club }: { club: RunClub }) {
  if (club.runs.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const shown = club.runs.slice(0, 2);
  const extra = club.runs.length - shown.length;
  return (
    <div className="flex flex-col gap-0.5">
      {shown.map((run, i) => (
        <span key={i} className="whitespace-nowrap">
          <span className="font-medium">{run.title}</span>{" "}
          <span className="text-muted-foreground">
            · {formatClubRunSchedule(run)}
          </span>
        </span>
      ))}
      {extra > 0 && (
        <span className="text-xs text-muted-foreground">+{extra} more</span>
      )}
    </div>
  );
}

export default function RunClubsPage() {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [clubs, setClubs] = useState<RunClub[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce both search fields so we don't hit the API on every keystroke.
  const [debounced, setDebounced] = useState({ q: "", location: "" });
  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(0);
      setDebounced({ q, location });
    }, 300);
    return () => clearTimeout(t);
  }, [q, location]);

  const fetchClubs = useCallback(
    async (search: { q: string; location: string }, pageOffset: number) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.q.trim()) params.set("q", search.q.trim());
      if (search.location.trim()) params.set("location", search.location.trim());
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageOffset));

      try {
        const res = await fetch(`/api/run-clubs?${params.toString()}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: { clubs: RunClub[]; total: number } = await res.json();
        setClubs(data.clubs);
        setTotal(data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load run clubs");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchClubs(debounced, offset);
  }, [fetchClubs, debounced, offset]);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search clubs by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1"
            aria-label="Search clubs by name"
          />
          <div className="relative flex-1">
            <MapPinIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Location (city or country)…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9"
              aria-label="Search clubs by location"
            />
          </div>
          <Button asChild>
            <Link href="/run-clubs/new">
              <PlusIcon className="size-4" />
              Add your club
            </Link>
          </Button>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Run clubs</h1>
          {!loading && !error && (
            <span className="text-sm text-muted-foreground">
              {total} club{total === 1 ? "" : "s"} found
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead>Website</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Loading run clubs…
                    </TableCell>
                  </TableRow>
                ) : clubs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No run clubs match your search. Know one?{" "}
                      <Link
                        href="/run-clubs/new"
                        className="text-primary hover:underline"
                      >
                        Add it
                      </Link>
                      .
                    </TableCell>
                  </TableRow>
                ) : (
                  clubs.map((club) => (
                    <TableRow key={club.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/run-clubs/${encodeURIComponent(club.id)}`}
                          className="hover:text-primary hover:underline"
                        >
                          {club.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {club.city}, {club.country}
                      </TableCell>
                      <TableCell>
                        <ScheduleSummary club={club} />
                      </TableCell>
                      <TableCell>
                        {club.website ? (
                          <a
                            href={club.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Website
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && !error && total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <span className="text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
