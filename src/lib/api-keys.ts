import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { RtApiKey } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { ApiKeyMeta } from "@/lib/types";

/**
 * REST API keys. A key is `rt_` + 48 hex chars, shown to the user exactly
 * once at creation; only its SHA-256 hash is stored (api_keys table).
 * Keys authenticate as the user who created them via `Authorization: Bearer`.
 *
 * Key management itself is deliberately session-only (see the /api/api-keys
 * routes): a leaked key cannot be used to mint or revoke keys.
 */

/** Requests allowed per key within each fixed one-hour window. */
export const API_KEY_RATE_LIMIT = 100;
const WINDOW_MS = 60 * 60 * 1000;

/** Max non-revoked keys per user. */
export const MAX_ACTIVE_KEYS = 10;

const TOKEN_PATTERN = /^rt_[a-f0-9]{48}$/;

export type ApiKeyVerification =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 429; error: string; retryAfterSeconds?: number };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function rowToMeta(row: RtApiKey): ApiKeyMeta {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revoked: row.revokedAt !== null,
  };
}

/** Create a key for a user. Returns the full token — the only time it exists in plaintext. */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ token: string; apiKey: ApiKeyMeta } | { error: string }> {
  const db = getPrisma();

  const active = await db.rtApiKey.count({
    where: { userId, revokedAt: null },
  });
  if (active >= MAX_ACTIVE_KEYS) {
    return {
      error: `You can have at most ${MAX_ACTIVE_KEYS} active API keys — revoke one first`,
    };
  }

  const token = `rt_${randomBytes(24).toString("hex")}`;
  const row = await db.rtApiKey.create({
    data: {
      userId,
      name,
      keyHash: hashToken(token),
      keyPrefix: token.slice(0, 11),
    },
  });

  return { token, apiKey: rowToMeta(row) };
}

/** All of a user's keys (including revoked), newest first. */
export async function listApiKeys(userId: string): Promise<ApiKeyMeta[]> {
  const rows = await getPrisma().rtApiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(rowToMeta);
}

/** Revoke one of the user's keys. Returns false when no matching active key exists. */
export async function revokeApiKey(
  userId: string,
  keyId: string,
): Promise<boolean> {
  // Scoped to the owning user so one user cannot revoke another's key.
  const { count } = await getPrisma().rtApiKey.updateMany({
    where: { id: keyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}

/**
 * Verify a bearer token and count the request against the key's rate limit
 * (fixed window: API_KEY_RATE_LIMIT requests per hour).
 */
export async function verifyApiKey(token: string): Promise<ApiKeyVerification> {
  if (!TOKEN_PATTERN.test(token)) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const db = getPrisma();
  const row = await db.rtApiKey.findUnique({
    where: { keyHash: hashToken(token) },
  });

  if (!row) return { ok: false, status: 401, error: "Invalid API key" };
  if (row.revokedAt) {
    return { ok: false, status: 401, error: "API key has been revoked" };
  }

  const now = Date.now();
  // A key that has never been used has no window; the epoch-based end date
  // is always in the past, which starts a fresh window below.
  const windowEnd = (row.windowStart?.getTime() ?? 0) + WINDOW_MS;
  const inWindow = now < windowEnd;

  if (inWindow && row.windowCount >= API_KEY_RATE_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit exceeded (${API_KEY_RATE_LIMIT} requests/hour per key)`,
      retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
    };
  }

  await db.rtApiKey.update({
    where: { id: row.id },
    data: {
      windowStart: inWindow ? row.windowStart : new Date(now),
      windowCount: inWindow ? row.windowCount + 1 : 1,
      lastUsedAt: new Date(now),
    },
  });

  return { ok: true, userId: row.userId };
}
