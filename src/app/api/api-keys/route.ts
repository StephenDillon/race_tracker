import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * API key management. Session-only on purpose — API keys cannot be used to
 * list, create, or revoke keys, so a leaked key can't escalate.
 */

/** GET /api/api-keys — list the current user's keys (metadata only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await listApiKeys(user.id);
  return NextResponse.json({ keys });
}

/**
 * POST /api/api-keys — create a key. Body: { name }.
 * Returns the full key exactly once; it is never retrievable again.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name =
    typeof (body as Record<string, unknown>)?.name === "string"
      ? ((body as Record<string, unknown>).name as string).trim()
      : "";
  if (!name || name.length > 60) {
    return NextResponse.json(
      { error: "name is required (1–60 characters)" },
      { status: 400 },
    );
  }

  const result = await createApiKey(user.id, name);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { key: result.token, apiKey: result.apiKey },
    { status: 201 },
  );
}
