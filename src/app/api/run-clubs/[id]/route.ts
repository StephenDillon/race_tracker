import { NextResponse } from "next/server";
import { authFailureResponse, getRequestUser } from "@/lib/auth";
import { getRaceStore } from "@/lib/db";
import { getUserRole, isModerator } from "@/lib/roles";
import { applyPlaceDetails, validateClubSubmission } from "@/lib/validate-run-club";

export const dynamic = "force-dynamic";

/** GET /api/run-clubs/:id — fetch a single run club. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const club = await getRaceStore().getRunClub(id);
  if (!club) {
    return NextResponse.json({ error: "Run club not found" }, { status: 404 });
  }
  return NextResponse.json({ club });
}

/**
 * PATCH /api/run-clubs/:id — edit a club (full payload, same shape as POST).
 * The owner may edit their club; moderators/admins may edit any club.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getRequestUser(request);
  if (!auth.ok) return authFailureResponse(auth);

  const { id } = await params;
  const store = getRaceStore();
  const existing = await store.getRunClub(id);
  if (!existing) {
    return NextResponse.json({ error: "Run club not found" }, { status: 404 });
  }

  const role = await getUserRole(auth.user.id);
  if (!isModerator(role) && existing.ownerId !== auth.user.id) {
    return NextResponse.json(
      { error: "You can only edit run clubs you own" },
      { status: 403 },
    );
  }

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

  const club = await store.updateRunClub(id, resolved);
  if (!club) {
    return NextResponse.json({ error: "Run club not found" }, { status: 404 });
  }
  return NextResponse.json({ club });
}

/**
 * DELETE /api/run-clubs/:id — remove a club. The owner may delete their
 * own club; moderators/admins may delete any club.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getRequestUser(request);
  if (!auth.ok) return authFailureResponse(auth);

  const { id } = await params;
  const store = getRaceStore();
  const existing = await store.getRunClub(id);
  if (!existing) {
    return NextResponse.json({ error: "Run club not found" }, { status: 404 });
  }

  const role = await getUserRole(auth.user.id);
  if (!isModerator(role) && existing.ownerId !== auth.user.id) {
    return NextResponse.json(
      { error: "You can only delete run clubs you own" },
      { status: 403 },
    );
  }

  const deleted = await store.deleteRunClub(id);
  if (!deleted) {
    return NextResponse.json({ error: "Run club not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
