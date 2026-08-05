import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole, listUsers } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * GET /api/users — all user accounts with roles. Admin only, and session-only
 * on purpose (like API key management): a leaked API key must not be able to
 * read the user list or escalate roles.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getUserRole(user.id)) !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const users = await listUsers();
  return NextResponse.json({ users });
}
