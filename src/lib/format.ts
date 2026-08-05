import { WEEKDAYS, type ClubRun, type RaceDistance } from "@/lib/types";

export function formatDistances(distances: RaceDistance[]): string {
  return distances
    .map((d) => (d.kind === "standard" ? d.distance : d.label))
    .join(", ");
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const MONTHLY_WEEK_LABELS: Record<string, string> = {
  "1": "1st",
  "2": "2nd",
  "3": "3rd",
  "4": "4th",
  last: "Last",
};

/** Short schedule line for a club run, e.g. "Wednesdays 18:30" or "1st Saturday 08:00". */
export function formatClubRunSchedule(run: ClubRun): string {
  switch (run.kind) {
    case "weekly":
      return `${WEEKDAYS[run.day]}s ${run.time}`;
    case "monthly":
      return `${MONTHLY_WEEK_LABELS[run.week]} ${WEEKDAYS[run.day]} of the month, ${run.time}`;
    case "event":
      return run.time ? `${formatDate(run.date)}, ${run.time}` : formatDate(run.date);
  }
}

export function formatCountdown(iso: string): string {
  const now = new Date();
  const race = new Date(`${iso}T00:00:00`);
  const diffMs = race.getTime() - now.getTime();
  if (diffMs < 0) return "Past";
  const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(" ");
}
