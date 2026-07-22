import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRaceStore } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ races: [], raceIds: [] });

  const store = getRaceStore();
  const [races, raceIds] = await Promise.all([
    store.getUserRaces(user.id),
    store.getUserRaceIds(user.id),
  ]);

  return NextResponse.json({ races, raceIds });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const raceId = typeof body.raceId === "string" ? body.raceId : null;
  if (!raceId) return NextResponse.json({ error: "raceId required" }, { status: 400 });

  const store = getRaceStore();
  await store.addUserRace(user.id, raceId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raceId = req.nextUrl.searchParams.get("raceId");
  if (!raceId) return NextResponse.json({ error: "raceId required" }, { status: 400 });

  const store = getRaceStore();
  await store.removeUserRace(user.id, raceId);
  return NextResponse.json({ ok: true });
}
