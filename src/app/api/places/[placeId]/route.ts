import { NextRequest, NextResponse } from "next/server";
import { authFailureResponse, getRequestUser } from "@/lib/auth";
import { countryNameFor, isPlacesConfigured, resolvePlace } from "@/lib/places";

export const dynamic = "force-dynamic";

/**
 * GET /api/places/:placeId — resolve a picked suggestion to address fields,
 * so the form can prefill address, city, region, and country.
 *
 * Query params:
 *   session  the same session token used for the autocomplete requests
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const auth = await getRequestUser(request);
  if (!auth.ok) return authFailureResponse(auth);

  if (!isPlacesConfigured()) {
    return NextResponse.json(
      { error: "Address lookup is not configured" },
      { status: 503 },
    );
  }

  const { placeId } = await params;
  const session = request.nextUrl.searchParams.get("session") ?? undefined;

  try {
    const place = await resolvePlace(placeId, session);
    if (!place) {
      return NextResponse.json(
        { error: "That address could not be resolved" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      place: { ...place, country: countryNameFor(place.countryCode) },
    });
  } catch (err) {
    console.error("Place details failed", err);
    return NextResponse.json(
      { error: "Address lookup failed" },
      { status: 502 },
    );
  }
}
