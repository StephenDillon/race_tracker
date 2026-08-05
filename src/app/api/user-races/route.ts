import { NextRequest, NextResponse } from "next/server";
import { authFailureResponse, getRequestUser } from "@/lib/auth";
import { getRaceStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * A user's saved races. All methods require authentication: the browser
 * session cookie, or an API key via `Authorization: Bearer rt_...`.
 */
export async function GET(req: NextRequest) {
  const auth = await getRequestUser(req);
  if (!auth.ok) return authFailureResponse(auth);

  const store = getRaceStore();
  const [races, raceIds] = await Promise.all([
    store.getUserRaces(auth.user.id),
    store.getUserRaceIds(auth.user.id),
  ]);

  return NextResponse.json({ races, raceIds });
}

export async function POST(req: NextRequest) {
  const auth = await getRequestUser(req);
  if (!auth.ok) return authFailureResponse(auth);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raceId = (body as Record<string, unknown> | null)?.raceId;
  if (typeof raceId !== "string" || !raceId) {
    return NextResponse.json({ error: "raceId required" }, { status: 400 });
  }

  const store = getRaceStore();
  // Scoped to the authenticated user — the body never carries a user id.
  await store.addUserRace(auth.user.id, raceId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getRequestUser(req);
  if (!auth.ok) return authFailureResponse(auth);

  const raceId = req.nextUrl.searchParams.get("raceId");
  if (!raceId) return NextResponse.json({ error: "raceId required" }, { status: 400 });

  const store = getRaceStore();
  await store.removeUserRace(auth.user.id, raceId);
  return NextResponse.json({ ok: true });
}
