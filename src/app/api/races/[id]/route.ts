import { NextResponse } from "next/server";
import { getRaceStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/races/:id — fetch a single race. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const race = await getRaceStore().getRace(id);
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  return NextResponse.json({ race });
}
