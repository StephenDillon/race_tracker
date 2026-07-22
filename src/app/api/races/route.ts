import { NextRequest, NextResponse } from "next/server";
import { continents, countries } from "countries-list";
import { getRaceStore } from "@/lib/db";
import {
  ENTRY_STATUSES,
  STANDARD_DISTANCES,
  type ContinentCode,
  type EntryStatus,
  type RaceDistance,
  type RaceFilters,
  type RaceSubmission,
  type StandardDistance,
} from "@/lib/types";

// The in-memory store is per-process state, so never prerender/cache this route.
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseBoolean(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/**
 * GET /api/races — list races with filters.
 *
 * Query params:
 *   q                  free-text search on race name
 *   dateFrom, dateTo   ISO dates (dateFrom defaults to today)
 *   distances          comma-separated standard distances (e.g. "5K,Marathon")
 *   continent          continent code (AF, AN, AS, EU, NA, OC, SA)
 *   country            ISO 3166-1 alpha-2 country code (e.g. "US"); wins over continent
 *   entryStatuses      comma-separated entry statuses (e.g. "open,ballot")
 *   majorMarathon      "true" | "false"
 *   majorQualifier     "true" | "false"
 *   limit, offset      pagination (limit defaults to 25, max 100)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const dateFrom = params.get("dateFrom") ?? undefined;
  const dateTo = params.get("dateTo") ?? undefined;
  if ((dateFrom && !ISO_DATE.test(dateFrom)) || (dateTo && !ISO_DATE.test(dateTo))) {
    return NextResponse.json(
      { error: "dateFrom/dateTo must be ISO dates (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const distances = params
    .get("distances")
    ?.split(",")
    .filter((d): d is StandardDistance =>
      (STANDARD_DISTANCES as readonly string[]).includes(d),
    );

  const entryStatuses = params
    .get("entryStatuses")
    ?.split(",")
    .filter((s): s is EntryStatus =>
      (ENTRY_STATUSES as readonly string[]).includes(s),
    );

  const continentParam = params.get("continent") ?? undefined;
  const continent =
    continentParam && continentParam in continents
      ? (continentParam as ContinentCode)
      : undefined;

  const countryParam = params.get("country")?.toUpperCase() ?? undefined;
  const countryCode =
    countryParam && countryParam in countries ? countryParam : undefined;

  const limitParam = Number(params.get("limit") ?? 25);
  const offsetParam = Number(params.get("offset") ?? 0);

  const filters: RaceFilters = {
    q: params.get("q") ?? undefined,
    dateFrom,
    dateTo,
    distances,
    continent,
    countryCode,
    entryStatuses,
    majorMarathon: parseBoolean(params.get("majorMarathon")),
    majorQualifier: parseBoolean(params.get("majorQualifier")),
    limit: Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25,
    offset: Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0,
  };

  const result = await getRaceStore().listRaces(filters);
  return NextResponse.json(result);
}

function validateSubmission(body: unknown): RaceSubmission | string {
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

  return {
    name: (b.name as string).trim(),
    date: b.date as string,
    distances,
    city: (b.city as string).trim(),
    region: (b.region as string).trim(),
    countryCode,
    entryStatus: b.entryStatus as EntryStatus,
    isMajorMarathon: b.isMajorMarathon === true,
    isMajorQualifier: b.isMajorQualifier === true,
    website: typeof b.website === "string" && b.website.trim() ? b.website.trim() : undefined,
    description:
      typeof b.description === "string" && b.description.trim()
        ? b.description.trim()
        : undefined,
  };
}

/** POST /api/races — submit a new race. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const submission = validateSubmission(body);
  if (typeof submission === "string") {
    return NextResponse.json({ error: submission }, { status: 400 });
  }

  const race = await getRaceStore().createRace(submission);
  return NextResponse.json({ race }, { status: 201 });
}
