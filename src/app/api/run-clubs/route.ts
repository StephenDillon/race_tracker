import { NextRequest, NextResponse } from "next/server";
import { authFailureResponse, getRequestUser } from "@/lib/auth";
import { getRaceStore } from "@/lib/db";
import { applyPlaceDetails, validateClubSubmission } from "@/lib/validate-run-club";
import type { RunClubFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/run-clubs — list run clubs.
 *
 * Query params:
 *   q              free-text search on club name
 *   location       free-text location search (matches city or country)
 *   limit, offset  pagination (limit defaults to 25, max 100)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const limitParam = Number(params.get("limit") ?? 25);
  const offsetParam = Number(params.get("offset") ?? 0);

  const filters: RunClubFilters = {
    q: params.get("q") ?? undefined,
    location: params.get("location") ?? undefined,
    limit: Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25,
    offset: Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0,
  };

  const result = await getRaceStore().listRunClubs(filters);
  return NextResponse.json(result);
}

/**
 * POST /api/run-clubs — create a run club. Requires authentication
 * (session cookie or API key); the creating user becomes the owner.
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

  const submission = validateClubSubmission(body);
  if (typeof submission === "string") {
    return NextResponse.json({ error: submission }, { status: 400 });
  }

  const resolved = await applyPlaceDetails(submission);
  if (typeof resolved === "string") {
    return NextResponse.json({ error: resolved }, { status: 400 });
  }

  const club = await getRaceStore().createRunClub(resolved, auth.user.id);
  return NextResponse.json({ club }, { status: 201 });
}
