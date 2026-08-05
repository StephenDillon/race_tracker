import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  const role = await getUserRole(user.id);
  return NextResponse.json({ user: { ...user, role } });
}
