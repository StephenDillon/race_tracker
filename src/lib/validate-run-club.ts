import { countries } from "countries-list";
import {
  MONTHLY_WEEKS,
  type ClubRun,
  type MonthlyWeek,
  type RunClubSubmission,
} from "@/lib/types";
import { ISO_DATE } from "@/lib/validate-race";
import { isPlacesConfigured, resolvePlace } from "@/lib/places";

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;

function isWeekday(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

/** Validate one run schedule entry; returns the normalized run or an error string. */
function validateRun(value: unknown): ClubRun | string {
  if (typeof value !== "object" || value === null) return "invalid run entry";
  const r = value as Record<string, unknown>;

  if (typeof r.title !== "string" || r.title.trim().length === 0) {
    return "each run needs a title";
  }
  const title = r.title.trim();
  const location =
    typeof r.location === "string" && r.location.trim()
      ? r.location.trim()
      : undefined;

  switch (r.kind) {
    case "weekly":
      if (!isWeekday(r.day)) return "weekly runs need a day (0=Sunday … 6=Saturday)";
      if (typeof r.time !== "string" || !TIME_24H.test(r.time)) {
        return "weekly runs need a time (HH:MM, 24h)";
      }
      return { kind: "weekly", title, day: r.day, time: r.time, location };
    case "monthly":
      if (!(MONTHLY_WEEKS as readonly string[]).includes(r.week as string)) {
        return `monthly runs need a week (${MONTHLY_WEEKS.join(", ")})`;
      }
      if (!isWeekday(r.day)) return "monthly runs need a day (0=Sunday … 6=Saturday)";
      if (typeof r.time !== "string" || !TIME_24H.test(r.time)) {
        return "monthly runs need a time (HH:MM, 24h)";
      }
      return {
        kind: "monthly",
        title,
        week: r.week as MonthlyWeek,
        day: r.day,
        time: r.time,
        location,
      };
    case "event":
      if (typeof r.date !== "string" || !ISO_DATE.test(r.date)) {
        return "events need a date (YYYY-MM-DD)";
      }
      if (r.time !== undefined && r.time !== "" && (typeof r.time !== "string" || !TIME_24H.test(r.time))) {
        return "event time must be HH:MM (24h)";
      }
      return {
        kind: "event",
        title,
        date: r.date,
        time: typeof r.time === "string" && r.time ? r.time : undefined,
        location,
      };
    default:
      return "each run must be weekly, monthly, or a one-off event";
  }
}

/**
 * Validate a run club create/edit payload. Returns the normalized submission,
 * or an error message string. Shared by POST /api/run-clubs and
 * PATCH /api/run-clubs/[id].
 */
export function validateClubSubmission(body: unknown): RunClubSubmission | string {
  if (typeof body !== "object" || body === null) return "Body must be a JSON object";
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return "name is required";
  }
  if (typeof b.city !== "string" || b.city.trim().length === 0) {
    return "city is required";
  }
  const countryCode =
    typeof b.countryCode === "string" ? b.countryCode.toUpperCase() : "";
  if (!(countryCode in countries)) {
    return "countryCode must be a valid ISO 3166-1 alpha-2 code";
  }

  const runs: ClubRun[] = [];
  if (b.runs !== undefined) {
    if (!Array.isArray(b.runs)) return "runs must be an array";
    for (const entry of b.runs) {
      const run = validateRun(entry);
      if (typeof run === "string") return run;
      runs.push(run);
    }
  }

  return {
    name: (b.name as string).trim(),
    city: (b.city as string).trim(),
    countryCode,
    address:
      typeof b.address === "string" && b.address.trim()
        ? b.address.trim()
        : undefined,
    region:
      typeof b.region === "string" && b.region.trim() ? b.region.trim() : undefined,
    website:
      typeof b.website === "string" && b.website.trim()
        ? b.website.trim()
        : undefined,
    runs,
    placeId:
      typeof b.placeId === "string" && b.placeId.trim()
        ? b.placeId.trim()
        : undefined,
  };
}

/**
 * Fill in the place-derived fields on a validated submission.
 *
 * The client sends only a `placeId`; everything Google knows about that place
 * is fetched here rather than trusted from the request, so a caller can't
 * attach coordinates or a country that don't match the place they picked.
 * `city` and `region` stay as the user left them — the form prefills both
 * from the same lookup but leaves them editable, because Google's locality
 * component is unreliable enough that a bad parse shouldn't be permanent.
 *
 * Submissions without a `placeId` (manual entry) pass through untouched.
 */
export async function applyPlaceDetails(
  submission: RunClubSubmission,
): Promise<RunClubSubmission | string> {
  if (!submission.placeId) return submission;

  if (!isPlacesConfigured()) {
    // Keep the club, drop the unverifiable place reference.
    return { ...submission, placeId: undefined };
  }

  let place;
  try {
    place = await resolvePlace(submission.placeId);
  } catch {
    return "Could not verify that address with Google. Try again.";
  }
  if (!place) return "That address could not be resolved";

  return {
    ...submission,
    countryCode: place.countryCode,
    formattedAddress: place.formattedAddress || undefined,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}
