"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Race, UpcomingClubRun } from "@/lib/types";
import { formatCountdown, formatDate, formatDistances } from "@/lib/format";
import { todayIso } from "@/lib/club-runs";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRightIcon,
  CalendarIcon,
  HeartIcon,
  MapPinIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";

/** How much of each list the dashboard shows before linking to the full page. */
const RACE_COUNT = 5;
const CLUB_RUN_COUNT = 6;
/** Window for "upcoming" club runs. */
const CLUB_RUN_DAYS = 7;

/** "Today" / "Tomorrow" read better than a date for the next couple of days. */
function relativeDay(iso: string): string {
  const today = todayIso();
  if (iso === today) return "Today";
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (iso === tomorrow.toISOString().slice(0, 10)) return "Tomorrow";
  return formatDate(iso);
}

function SectionCard({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {linkLabel}
            <ArrowRightIcon className="size-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

/** Signed-out landing: what the site is, and where to start. */
function Intro() {
  return (
    <div className="flex flex-col gap-8 py-6">
      <section className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Find your next race
        </h1>
        <p className="mt-4 text-muted-foreground">
          Race Finder collects running races from around the world — 5Ks to 100
          milers — so you can search by date, distance, location, and whether
          entries are still open. It also lists run clubs and their weekly
          meetups, for the training in between.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="size-5 text-primary" />
              Races
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Browse upcoming races and filter by distance, dates, location, and
              entry status — including the World Majors and their qualifiers.
            </p>
            <Button asChild className="self-start">
              <Link href="/races">
                Find races
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-5 text-primary" />
              Run Clubs
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Find a run club near you, see when and where they meet, and add
              your own club so other runners can find it.
            </p>
            <Button asChild variant="outline" className="self-start">
              <Link href="/run-clubs">
                Find run clubs
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>{" "}
        to save races to your own list and submit races and clubs.
      </p>
    </div>
  );
}

/** Signed-in dashboard: the user's upcoming races and nearby club runs. */
function Dashboard({ email }: { email: string }) {
  const [races, setRaces] = useState<Race[] | null>(null);
  const [clubRuns, setClubRuns] = useState<UpcomingClubRun[] | null>(null);

  useEffect(() => {
    const today = todayIso();

    fetch("/api/user-races")
      .then((r) => (r.ok ? r.json() : { races: [] }))
      .then((d: { races: Race[] }) =>
        setRaces(
          (d.races ?? [])
            .filter((race) => race.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, RACE_COUNT),
        ),
      )
      .catch(() => setRaces([]));

    fetch(
      `/api/run-clubs/upcoming?days=${CLUB_RUN_DAYS}&limit=${CLUB_RUN_COUNT}`,
    )
      .then((r) => (r.ok ? r.json() : { runs: [] }))
      .then((d: { runs: UpcomingClubRun[] }) => setClubRuns(d.runs ?? []))
      .catch(() => setClubRuns([]));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/races">Find races</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/run-clubs">Find run clubs</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Your upcoming races" href="/my-races" linkLabel="My races">
          {races === null ? (
            <EmptyState>Loading…</EmptyState>
          ) : races.length === 0 ? (
            <EmptyState>
              No upcoming races saved yet. Tap the{" "}
              <HeartIcon className="inline size-3.5 align-text-bottom" /> on any
              race to add it here —{" "}
              <Link href="/races" className="text-primary hover:underline">
                browse races
              </Link>
              .
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {races.map((race) => (
                <li
                  key={race.id}
                  className="flex items-baseline justify-between gap-4 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/races/${encodeURIComponent(race.id)}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {race.name}
                    </Link>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="font-mono">{formatDate(race.date)}</span>
                      <span>{formatDistances(race.distances)}</span>
                      <span>
                        {race.city}, {race.country}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold whitespace-nowrap">
                    {formatCountdown(race.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={`Club runs in the next ${CLUB_RUN_DAYS} days`}
          href="/run-clubs"
          linkLabel="All clubs"
        >
          {clubRuns === null ? (
            <EmptyState>Loading…</EmptyState>
          ) : clubRuns.length === 0 ? (
            <EmptyState>
              No club runs scheduled this week.{" "}
              <Link href="/run-clubs/new" className="text-primary hover:underline">
                Add your club
              </Link>
              .
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {clubRuns.map((run, i) => (
                <li
                  key={`${run.clubId}-${run.date}-${run.title}-${i}`}
                  className="flex items-baseline justify-between gap-4 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{run.title}</span>{" "}
                    <Link
                      href={`/run-clubs/${encodeURIComponent(run.clubId)}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {run.clubName}
                    </Link>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon className="size-3" />
                        {run.location ?? `${run.city}, ${run.country}`}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-sm whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <CalendarIcon className="size-3" />
                      {relativeDay(run.date)}
                    </span>
                    {run.time && (
                      <span className="block text-xs text-muted-foreground">
                        {run.time}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, loaded } = useCurrentUser();

  if (!loaded) {
    return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  }

  return user ? <Dashboard email={user.email} /> : <Intro />;
}
