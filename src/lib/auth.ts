import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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
