"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { ClubRun, Role, RunClub } from "@/lib/types";
import { formatClubRunSchedule } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ExternalLinkIcon,
  MapPinIcon,
  PencilIcon,
  RepeatIcon,
} from "lucide-react";

const RUN_KIND_LABELS: Record<ClubRun["kind"], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  event: "Event",
};

function RunRow({ run }: { run: ClubRun }) {
  return (
    <div className="flex items-start gap-3 py-3">
      {run.kind === "event" ? (
        <CalendarIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      ) : (
        <RepeatIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{run.title}</span>
          <Badge variant="secondary" className="text-xs">
            {RUN_KIND_LABELS[run.kind]}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {formatClubRunSchedule(run)}
        </span>
        {run.location && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPinIcon className="size-3.5" />
            {run.location}
          </span>
        )}
      </div>
    </div>
  );
}

export default function RunClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [club, setClub] = useState<RunClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState<{ id: string; role: Role } | null>(null);

  useEffect(() => {
    fetch(`/api/run-clubs/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error();
        const data: { club: RunClub } = await res.json();
        setClub(data.club);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: { id: string; role: Role } | null }) => setMe(d.user))
      .catch(() => {});
  }, [id]);

  const canEdit =
    !!club &&
    !!me &&
    (me.role === "admin" || me.role === "moderator" || club.ownerId === me.id);

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  if (notFound || !club) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-muted-foreground">Run club not found.</p>
            <Button variant="outline" asChild>
              <Link href="/run-clubs">
                <ArrowLeftIcon className="size-4" />
                Back to run clubs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Recurring runs first, then one-off events by date.
  const recurring = club.runs.filter((r) => r.kind !== "event");
  const events = club.runs
    .filter((r): r is Extract<ClubRun, { kind: "event" }> => r.kind === "event")
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/run-clubs">
            <ArrowLeftIcon className="size-4" />
            Back to run clubs
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-2xl tracking-tight">{club.name}</CardTitle>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/run-clubs/${encodeURIComponent(id)}/edit`}>
                  <PencilIcon className="size-4" />
                  Edit
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            <MapPinIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Location
              </span>
              <div className="text-sm">
                {club.address && <div>{club.address}</div>}
                <div className="text-muted-foreground">
                  {[club.city, club.region, club.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              </div>
            </div>
          </div>

          {(recurring.length > 0 || events.length > 0) && (
            <>
              <Separator />
              <div>
                <h2 className="mb-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Runs
                </h2>
                <div className="divide-y">
                  {recurring.map((run, i) => (
                    <RunRow key={`r-${i}`} run={run} />
                  ))}
                  {events.map((run, i) => (
                    <RunRow key={`e-${i}`} run={run} />
                  ))}
                </div>
              </div>
            </>
          )}

          {club.website && (
            <>
              <Separator />
              <div>
                <Button asChild>
                  <a
                    href={club.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Club website
                    <ExternalLinkIcon className="size-4" />
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
