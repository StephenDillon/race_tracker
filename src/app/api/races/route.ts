import { NextRequest, NextResponse } from "next/server";
import { continents, countries } from "countries-list";
import { authFailureResponse, getRequestUser } from "@/lib/auth";
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

/**
 * GET /api/races — list races with filters.
 *
 * Query params:
 *   q                  free-text search on race name
 *   dateFrom, dateTo   ISO dates (dateFrom defaults to today)
 *   distances          comma-separated standard distances (e.g. "5K,Marathon")
 *   continents         comma-separated continent codes (AF, AN, AS, EU, NA, OC, SA)
 *   countries          comma-separated ISO 3166-1 alpha-2 codes (e.g. "US,CA")
 *   cities             comma-separated city names; continents/countries/cities are OR-ed
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

  const continentsParam = params
    .get("continents")
    ?.split(",")
    .filter((c): c is ContinentCode => c in continents);

  const countryCodes = params
    .get("countries")
    ?.split(",")
    .map((c) => c.toUpperCase())
    .filter((c) => c in countries);

  const cities = params
    .get("cities")
    ?.split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const limitParam = Number(params.get("limit") ?? 25);
  const offsetParam = Number(params.get("offset") ?? 0);

  const filters: RaceFilters = {
    q: params.get("q") ?? undefined,
    dateFrom,
    dateTo,
    distances,
    continents: continentsParam,
    countryCodes,
    cities,
    entryStatuses,
    tags: params.get("tags")?.split(",").filter(Boolean),
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
    tags: Array.isArray(b.tags) ? (b.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
    website: typeof b.website === "string" && b.website.trim() ? b.website.trim() : undefined,
    description:
      typeof b.description === "string" && b.description.trim()
        ? b.description.trim()
        : undefined,
  };
}

/**
 * POST /api/races — submit a new race.
 *
 * Requires authentication: a logged-in session, or an API key sent as
 * `Authorization: Bearer rt_...` (created under Settings; rate-limited).
 * Rejects duplicates (409) when a race with the same name, date, city,
 * and country already exists.
 */
export async function POST(request: NextRequest) {
  const auth = await getRequestUser(request);
  if (!auth.ok) return authFailureResponse(auth);

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

  const store = getRaceStore();
  const duplicate = await store.findDuplicateRace(
    submission.name,
    submission.date,
    submission.city,
    submission.countryCode,
  );
  if (duplicate) {
    return NextResponse.json(
      {
        error: "A race with the same name, date, and location already exists",
        race: duplicate,
      },
      { status: 409 },
    );
  }

  try {
    const race = await store.createRace(submission);
    return NextResponse.json({ race }, { status: 201 });
  } catch (err) {
    // Backstop for the unique dedup index racing with the pre-check above.
    if (err instanceof Error && err.message.includes("rt_races_dedup_idx")) {
      return NextResponse.json(
        { error: "A race with the same name, date, and location already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}
