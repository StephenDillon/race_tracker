import { NextRequest, NextResponse } from "next/server";
import { getRaceStore } from "@/lib/db";
import { todayIso, upcomingClubRuns } from "@/lib/club-runs";

export const dynamic = "force-dynamic";

/** How many clubs' schedules to expand. Well above the current club count. */
const CLUB_SCAN_LIMIT = 500;

/**
 * GET /api/run-clubs/upcoming — club runs happening in the next few days,
 * expanded from every club's schedule. Public, like the club listing.
 *
 * Query params:
 *   days   window size in days, from today (default 7, max 60)
 *   limit  max occurrences returned (default 10, max 100)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const daysParam = Number(params.get("days") ?? 7);
  const limitParam = Number(params.get("limit") ?? 10);
  const days = Number.isFinite(daysParam)
    ? Math.min(Math.max(Math.trunc(daysParam), 1), 60)
    : 7;
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 10;

  const { clubs } = await getRaceStore().listRunClubs({ limit: CLUB_SCAN_LIMIT });
  const runs = upcomingClubRuns(clubs, { from: todayIso(), days, limit });

  return NextResponse.json({ runs });
}
