import { NextRequest, NextResponse } from "next/server";
import { authFailureResponse, getRequestUser } from "@/lib/auth";
import { autocompleteAddress, isPlacesConfigured } from "@/lib/places";

export const dynamic = "force-dynamic";

/**
 * GET /api/places — address suggestions for the club form's typeahead.
 *
 * Proxies Google Places so the API key stays server-side. Requires auth:
 * Places calls are metered, so an open proxy would be a billing drain.
 *
 * Query params:
 *   q        partial address (required)
 *   session  autocomplete session token; pass the same one to /api/places/[placeId]
 */
export async function GET(request: NextRequest) {
  const auth = await getRequestUser(request);
  if (!auth.ok) return authFailureResponse(auth);

  if (!isPlacesConfigured()) {
    return NextResponse.json(
      { error: "Address lookup is not configured" },
      { status: 503 },
    );
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ suggestions: [] });

  const session = params.get("session") ?? "";
  if (!session) {
    return NextResponse.json({ error: "session is required" }, { status: 400 });
  }

  try {
    const suggestions = await autocompleteAddress(q, session);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Places autocomplete failed", err);
    return NextResponse.json(
      { error: "Address lookup failed" },
      { status: 502 },
    );
  }
}
