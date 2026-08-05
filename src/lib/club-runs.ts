/**
 * Expanding a run club's schedule into dated occurrences.
 *
 * Clubs store a repeating schedule (`ClubRun`), not generated rows, so the
 * dashboard has to walk forward from today and ask "does this run happen on
 * this day?". Dates are handled as UTC-anchored `YYYY-MM-DD` strings so the
 * answer doesn't shift with the runtime's timezone.
 *
 * No server imports — usable from both API routes and client components.
 */
import type { ClubRun, RunClub, UpcomingClubRun } from "@/lib/types";

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Today as `YYYY-MM-DD` in the caller's local timezone. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whether `run` takes place on `date` (a UTC-anchored midnight). */
export function runOccursOn(run: ClubRun, date: Date): boolean {
  switch (run.kind) {
    case "weekly":
      return date.getUTCDay() === run.day;
    case "monthly": {
      if (date.getUTCDay() !== run.day) return false;
      const dayOfMonth = date.getUTCDate();
      if (run.week === "last") {
        // No same weekday left this month means this is the last one.
        const daysInMonth = new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
        ).getUTCDate();
        return dayOfMonth + 7 > daysInMonth;
      }
      return Math.floor((dayOfMonth - 1) / 7) + 1 === Number(run.week);
    }
    case "event":
      return run.date === dateToIso(date);
  }
}

/**
 * Every occurrence across `clubs` from `from` (inclusive) through the next
 * `days` days, sorted by date then start time. Capped at `limit` entries.
 */
export function upcomingClubRuns(
  clubs: RunClub[],
  { from, days, limit }: { from: string; days: number; limit: number },
): UpcomingClubRun[] {
  const start = isoToDate(from);
  const occurrences: UpcomingClubRun[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(start, offset);
    const iso = dateToIso(date);

    for (const club of clubs) {
      for (const run of club.runs) {
        if (!runOccursOn(run, date)) continue;
        occurrences.push({
          clubId: club.id,
          clubName: club.name,
          city: club.city,
          country: club.country,
          date: iso,
          title: run.title,
          time: run.time,
          location: run.location ?? club.address,
        });
      }
    }
  }

  // Within a day, earlier start times first; runs without a time go last.
  occurrences.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99"),
  );

  return occurrences.slice(0, limit);
}
