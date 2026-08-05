import { NextRequest, NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** DELETE /api/api-keys/[id] — revoke a key. Session-only (see ../route.ts). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const revoked = await revokeApiKey(user.id, id);
  if (!revoked) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
