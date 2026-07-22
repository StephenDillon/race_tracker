import type { RaceDistance } from "@/lib/types";

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

export function formatCountdown(iso: string): string {
  const now = new Date();
  const race = new Date(`${iso}T00:00:00`);
  const diffMs = race.getTime() - now.getTime();
  if (diffMs < 0) return "Past";
  const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(totalDays / 30);
  const weeks = Math.floor((totalDays % 30) / 7);
  const days = totalDays % 7;
  const parts: string[] = [];
  if (months > 0) parts.push(`${months}mo`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0 || parts.length === 0) parts.push(`${days}d`);
  return parts.join(" ");
}
