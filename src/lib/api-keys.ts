import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApiKeyMeta } from "@/lib/types";

/**
 * REST API keys. A key is `rt_` + 48 hex chars, shown to the user exactly
 * once at creation; only its SHA-256 hash is stored (rt_api_keys table).
 * Keys authenticate as the user who created them via `Authorization: Bearer`.
 *
 * Key management itself is deliberately session-only (see the /api/api-keys
 * routes): a leaked key cannot be used to mint or revoke keys.
 */

const TABLE = "rt_api_keys";

/** Requests allowed per key within each fixed one-hour window. */
export const API_KEY_RATE_LIMIT = 100;
const WINDOW_MS = 60 * 60 * 1000;

/** Max non-revoked keys per user. */
export const MAX_ACTIVE_KEYS = 10;

const TOKEN_PATTERN = /^rt_[a-f0-9]{48}$/;

interface RtApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  window_start: string | null;
  window_count: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export type ApiKeyVerification =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 429; error: string; retryAfterSeconds?: number };

// Cached like the race store (src/lib/db/index.ts) so the client is reused.
const globalCache = globalThis as unknown as { __rtApiKeyClient?: SupabaseClient };

function getClient(): SupabaseClient {
  if (!globalCache.__rtApiKeyClient) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    globalCache.__rtApiKeyClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return globalCache.__rtApiKeyClient;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function rowToMeta(row: RtApiKeyRow): ApiKeyMeta {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revoked: row.revoked_at !== null,
  };
}

/** Create a key for a user. Returns the full token — the only time it exists in plaintext. */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ token: string; apiKey: ApiKeyMeta } | { error: string }> {
  const client = getClient();

  const { count, error: countError } = await client
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (countError) throw new Error(`Failed to count API keys: ${countError.message}`);
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    return { error: `You can have at most ${MAX_ACTIVE_KEYS} active API keys — revoke one first` };
  }

  const token = `rt_${randomBytes(24).toString("hex")}`;
  const { data, error } = await client
    .from(TABLE)
    .insert({
      user_id: userId,
      name,
      key_hash: hashToken(token),
      key_prefix: token.slice(0, 11),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create API key: ${error.message}`);
  return { token, apiKey: rowToMeta(data as RtApiKeyRow) };
}

/** All of a user's keys (including revoked), newest first. */
export async function listApiKeys(userId: string): Promise<ApiKeyMeta[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list API keys: ${error.message}`);
  return (data as RtApiKeyRow[]).map(rowToMeta);
}

/** Revoke one of the user's keys. Returns false when no matching active key exists. */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const { data, error } = await getClient()
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id");

  if (error) throw new Error(`Failed to revoke API key: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Verify a bearer token and count the request against the key's rate limit
 * (fixed window: API_KEY_RATE_LIMIT requests per hour).
 */
export async function verifyApiKey(token: string): Promise<ApiKeyVerification> {
  if (!TOKEN_PATTERN.test(token)) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const client = getClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("key_hash", hashToken(token))
    .maybeSingle();

  if (error) throw new Error(`Failed to verify API key: ${error.message}`);
  const row = data as RtApiKeyRow | null;
  if (!row) return { ok: false, status: 401, error: "Invalid API key" };
  if (row.revoked_at) return { ok: false, status: 401, error: "API key has been revoked" };

  const now = Date.now();
  const windowStart = row.window_start ? Date.parse(row.window_start) : null;
  let newStart = windowStart;
  let newCount: number;

  if (windowStart === null || now - windowStart >= WINDOW_MS) {
    newStart = now;
    newCount = 1;
  } else if (row.window_count >= API_KEY_RATE_LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000));
    return {
      ok: false,
      status: 429,
      error: `Rate limit exceeded (${API_KEY_RATE_LIMIT} requests/hour per key)`,
      retryAfterSeconds,
    };
  } else {
    newCount = row.window_count + 1;
  }

  const { error: updateError } = await client
    .from(TABLE)
    .update({
      window_start: new Date(newStart!).toISOString(),
      window_count: newCount,
      last_used_at: new Date(now).toISOString(),
    })
    .eq("id", row.id);
  if (updateError) throw new Error(`Failed to update API key usage: ${updateError.message}`);

  return { ok: true, userId: row.user_id };
}
