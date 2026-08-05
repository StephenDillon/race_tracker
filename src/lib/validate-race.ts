import { countries } from "countries-list";
import {
  ENTRY_STATUSES,
  STANDARD_DISTANCES,
  type EntryMethod,
  type EntryStatus,
  type RaceDistance,
  type RaceSubmission,
  type StandardDistance,
} from "@/lib/types";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a race submission/edit payload. Returns the normalized submission,
 * or an error message string. Shared by POST /api/races and PATCH /api/races/[id].
 */
export function validateSubmission(body: unknown): RaceSubmission | string {
  if (typeof body !== "object" || body === null) return "Body must be a JSON object";
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return "name is required";
  }
  if (typeof b.date !== "string" || !ISO_DATE.test(b.date)) {
    return "date is required (YYYY-MM-DD)";
  }
  for (const field of ["city", "region"] as const) {
    if (typeof b[field] !== "string" || (b[field] as string).trim().length === 0) {
      return `${field} is required`;
    }
  }
  const countryCode =
    typeof b.countryCode === "string" ? b.countryCode.toUpperCase() : "";
  if (!(countryCode in countries)) {
    return "countryCode must be a valid ISO 3166-1 alpha-2 code";
  }
  if (!(ENTRY_STATUSES as readonly string[]).includes(b.entryStatus as string)) {
    return `entryStatus must be one of: ${ENTRY_STATUSES.join(", ")}`;
  }

  if (!Array.isArray(b.distances) || b.distances.length === 0) {
    return "at least one distance is required";
  }
  const distances: RaceDistance[] = [];
  for (const d of b.distances) {
    if (typeof d !== "object" || d === null) return "invalid distance entry";
    const dist = d as Record<string, unknown>;
    if (
      dist.kind === "standard" &&
      (STANDARD_DISTANCES as readonly string[]).includes(dist.distance as string)
    ) {
      distances.push({
        kind: "standard",
        distance: dist.distance as StandardDistance,
      });
    } else if (
      dist.kind === "custom" &&
      typeof dist.label === "string" &&
      dist.label.trim().length > 0 &&
      typeof dist.kilometers === "number" &&
      dist.kilometers > 0
    ) {
      distances.push({
        kind: "custom",
        label: dist.label.trim(),
        kilometers: dist.kilometers,
      });
    } else {
      return "each distance must be a standard distance or a custom {label, kilometers}";
    }
  }

  const entryMethods: EntryMethod[] = [];
  if (b.entryMethods !== undefined) {
    if (!Array.isArray(b.entryMethods)) {
      return "entryMethods must be an array of {method, opens, closes}";
    }
    for (const m of b.entryMethods) {
      if (typeof m !== "object" || m === null) return "invalid entry method";
      const em = m as Record<string, unknown>;
      if (
        typeof em.method !== "string" ||
        em.method.trim().length === 0 ||
        typeof em.opens !== "string" ||
        !ISO_DATE.test(em.opens) ||
        typeof em.closes !== "string" ||
        !ISO_DATE.test(em.closes)
      ) {
        return "each entry method needs a method name and opens/closes ISO dates";
      }
      entryMethods.push({
        method: em.method.trim(),
        opens: em.opens,
        closes: em.closes,
      });
    }
  }

  return {
    name: (b.name as string).trim(),
    date: b.date as string,
    distances,
    city: (b.city as string).trim(),
    region: (b.region as string).trim(),
    countryCode,
    entryStatus: b.entryStatus as EntryStatus,
    tags: Array.isArray(b.tags)
      ? (b.tags as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    entryMethods,
    website: typeof b.website === "string" && b.website.trim() ? b.website.trim() : undefined,
    description:
      typeof b.description === "string" && b.description.trim()
        ? b.description.trim()
        : undefined,
  };
}
