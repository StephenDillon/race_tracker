"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Race, Role } from "@/lib/types";
import { formatCountdown, formatDate } from "@/lib/format";
import { useSavedRaces } from "@/lib/use-saved-races";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EntryStatusBadge } from "@/components/entry-status-badge";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ExternalLinkIcon,
  HeartIcon,
  MapPinIcon,
  PencilIcon,
  RouteIcon,
  TicketIcon,
} from "lucide-react";

/** One labeled fact in the details grid. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

export default function RaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [race, setRace] = useState<Race | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState<{ id: string; role: Role } | null>(null);

  const { isSaved, toggleSaved } = useSavedRaces();
  const saved = isSaved(id);

  useEffect(() => {
    fetch(`/api/races/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error();
        const data: { race: Race } = await res.json();
        setRace(data.race);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: { id: string; role: Role } | null }) => setMe(d.user))
      .catch(() => {});
  }, [id]);

  const canEdit =
    !!race &&
    !!me &&
    (me.role === "admin" || me.role === "moderator" || race.submittedBy === me.id);

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  if (notFound || !race) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-muted-foreground">Race not found.</p>
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeftIcon className="size-4" />
                Back to races
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
            Back to races
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-2xl tracking-tight">
                {race.name}
              </CardTitle>
              {race.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {race.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/races/${encodeURIComponent(id)}/edit`}>
                    <PencilIcon className="size-4" />
                    Edit
                  </Link>
                </Button>
              )}
              <Button
                variant={saved ? "secondary" : "outline"}
                size="sm"
                onClick={() => toggleSaved(id)}
              >
                <HeartIcon
                  className={`size-4 ${saved ? "fill-primary text-primary" : ""}`}
                />
                {saved ? "Saved" : "Save race"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Fact icon={CalendarIcon} label="Date">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono">{formatDate(race.date)}</span>
                <span className="text-muted-foreground">
                  {formatCountdown(race.date)}
                  {formatCountdown(race.date) !== "Past" && " to go"}
                </span>
              </div>
            </Fact>

            <Fact icon={MapPinIcon} label="Location">
              {race.city}, {race.region}, {race.country}
            </Fact>

            <Fact icon={RouteIcon} label="Distances">
              <div className="flex flex-wrap gap-1">
                {race.distances.map((d) => (
                  <Badge
                    key={d.kind === "standard" ? d.distance : d.label}
                    variant="outline"
                  >
                    {d.kind === "standard"
                      ? d.distance
                      : `${d.label} (${d.kilometers} km)`}
                  </Badge>
                ))}
              </div>
            </Fact>

            <Fact icon={TicketIcon} label="Entry">
              <EntryStatusBadge status={race.entryStatus} />
            </Fact>
          </div>

          {race.entryMethods.length > 0 && (
            <>
              <Separator />
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Entry Method</th>
                      <th className="px-3 py-2 text-left font-medium">Opens</th>
                      <th className="px-3 py-2 text-left font-medium">Closes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {race.entryMethods.map((m) => (
                      <tr key={m.method} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{m.method}</td>
                        <td className="px-3 py-2 font-mono">{formatDate(m.opens)}</td>
                        <td className="px-3 py-2 font-mono">{formatDate(m.closes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {race.description && (
            <>
              <Separator />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {race.description}
              </p>
            </>
          )}

          {race.website && (
            <>
              <Separator />
              <div>
                <Button asChild>
                  <a
                    href={race.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official website
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
