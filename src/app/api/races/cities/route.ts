import { NextRequest, NextResponse } from "next/server";
import { getRaceStore } from "@/lib/db";

// Backed by live race data; never prerender/cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/races/cities — search distinct cities that host races,
 * for the location filter's typeahead.
 *
 * Query params:
 *   q      substring to match against city names (required)
 *   limit  max results (defaults to 10, max 25)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ cities: [] });

  const limitParam = Number(params.get("limit") ?? 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 25)
    : 10;

  const cities = await getRaceStore().searchCities(q, limit);
  return NextResponse.json({ cities });
}
