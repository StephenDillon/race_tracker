import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyApiKey } from "@/lib/api-keys";

const TOKEN_COOKIE = "rt_token";
const REFRESH_COOKIE = "rt_refresh";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function signup(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) return { error: "Auth not configured" };

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return { error: error.message };

  const { data: signIn, error: signInError } =
    await client.auth.signInWithPassword({ email, password });

  if (signInError) return { error: signInError.message };

  await setSessionCookies(
    signIn.session.access_token,
    signIn.session.refresh_token,
  );

  return {
    user: { id: data.user.id, email: data.user.email },
  };
}

export async function login(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) return { error: "Auth not configured" };

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { error: error.message };

  await setSessionCookies(
    data.session.access_token,
    data.session.refresh_token,
  );

  return {
    user: { id: data.user.id, email: data.user.email },
  };
}

export async function logout() {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) return null;

  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await client.auth.getUser(token);
  if (!error && data.user) {
    return { id: data.user.id, email: data.user.email };
  }

  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  const { data: refreshed, error: refreshError } =
    await client.auth.refreshSession({ refresh_token: refresh });

  if (refreshError || !refreshed.session) return null;

  await setSessionCookies(
    refreshed.session.access_token,
    refreshed.session.refresh_token,
  );

  return {
    id: refreshed.user!.id,
    email: refreshed.user!.email,
  };
}

/**
 * Result of authenticating an incoming API request. `via` says which
 * credential was used; API-key auth only knows the user id (no email).
 */
export type RequestAuth =
  | { ok: true; user: { id: string; email?: string | null }; via: "session" | "api_key" }
  | { ok: false; status: number; error: string; retryAfterSeconds?: number };

/**
 * Authenticate a request for protected API routes. Accepts either an
 * `Authorization: Bearer rt_...` API key (rate-limited, see api-keys.ts)
 * or the browser session cookie. An Authorization header, when present,
 * wins — its failures are not silently downgraded to the cookie session.
 */
export async function getRequestUser(request: Request): Promise<RequestAuth> {
  const header = request.headers.get("authorization");
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      return {
        ok: false,
        status: 401,
        error: "Malformed Authorization header (expected: Bearer <api key>)",
      };
    }
    const result = await verifyApiKey(match[1].trim());
    if (!result.ok) return result;
    return { ok: true, user: { id: result.userId }, via: "api_key" };
  }

  const user = await getCurrentUser();
  if (user) return { ok: true, user, via: "session" };

  return {
    ok: false,
    status: 401,
    error:
      "Authentication required: log in, or send an API key via 'Authorization: Bearer rt_...' (create one under Settings)",
  };
}

/** JSON error response for a failed getRequestUser, with Retry-After on 429s. */
export function authFailureResponse(failure: Extract<RequestAuth, { ok: false }>) {
  const res = NextResponse.json({ error: failure.error }, { status: failure.status });
  if (failure.retryAfterSeconds !== undefined) {
    res.headers.set("Retry-After", String(failure.retryAfterSeconds));
  }
  return res;
}

async function setSessionCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const shared = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  jar.set(TOKEN_COOKIE, accessToken, { ...shared, maxAge: 60 * 60 });
  jar.set(REFRESH_COOKIE, refreshToken, {
    ...shared,
    maxAge: 60 * 60 * 24 * 30,
  });
}
