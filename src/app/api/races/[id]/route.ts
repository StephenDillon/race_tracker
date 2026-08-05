import { NextResponse } from "next/server";
import { authFailureResponse, getRequestUser } from "@/lib/auth";
import { getRaceStore } from "@/lib/db";
import { getUserRole, isModerator } from "@/lib/roles";
import { validateSubmission } from "@/lib/validate-race";

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

/**
 * PATCH /api/races/:id — edit a race (full payload, same shape as POST).
 * Moderators/admins may edit any race; users only races they submitted.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getRequestUser(request);
  if (!auth.ok) return authFailureResponse(auth);

  const { id } = await params;
  const store = getRaceStore();
  const existing = await store.getRace(id);
  if (!existing) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  const role = await getUserRole(auth.user.id);
  if (!isModerator(role) && existing.submittedBy !== auth.user.id) {
    return NextResponse.json(
      { error: "You can only edit races you submitted" },
      { status: 403 },
    );
  }

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

  // The dedup rule still applies, but the race being edited is not its own duplicate.
  const duplicate = await store.findDuplicateRace(
    submission.name,
    submission.date,
    submission.city,
    submission.countryCode,
  );
  if (duplicate && duplicate.id !== id) {
    return NextResponse.json(
      {
        error: "A race with the same name, date, and location already exists",
        race: duplicate,
      },
      { status: 409 },
    );
  }

  const race = await store.updateRace(id, submission);
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  return NextResponse.json({ race });
}

/** DELETE /api/races/:id — remove a race. Moderators and admins only. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getRequestUser(request);
  if (!auth.ok) return authFailureResponse(auth);

  const role = await getUserRole(auth.user.id);
  if (!isModerator(role)) {
    return NextResponse.json(
      { error: "Only moderators and admins can delete races" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const deleted = await getRaceStore().deleteRace(id);
  if (!deleted) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
