import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole, setUserRole } from "@/lib/roles";
import { ROLES, type Role } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/users/:id — set a user's role. Body: { role }.
 * Admin + session only (see ../route.ts). Admins cannot change their own
 * role, so the system can't be left without an admin by accident.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getUserRole(user.id)) !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const role = (body as Record<string, unknown>)?.role;
  if (!(ROLES as readonly string[]).includes(role as string)) {
    return NextResponse.json(
      { error: `role must be one of: ${ROLES.join(", ")}` },
      { status: 400 },
    );
  }

  await setUserRole(id, role as Role);
  return NextResponse.json({ ok: true });
}
