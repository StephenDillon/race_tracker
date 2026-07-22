import "server-only";

import type { RaceStore } from "./store";
import { MemoryRaceStore } from "./memory";
import { SupabaseRaceStore } from "./supabase";

/**
 * Single entry point to the data layer. Server-side only — the `server-only`
 * import makes any accidental client-side import a build error, keeping
 * database access (and Supabase keys) off the client.
 *
 * Uses Supabase when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set
 * (production on Vercel), otherwise falls back to the in-memory store
 * (local dev without credentials).
 *
 * The store is cached on globalThis so the client is reused across requests
 * and submitted races survive dev-server hot reloads when using memory.
 */
const globalStore = globalThis as unknown as { __raceStore?: RaceStore };

export function getRaceStore(): RaceStore {
  if (!globalStore.__raceStore) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalStore.__raceStore =
      url && serviceRoleKey
        ? new SupabaseRaceStore(url, serviceRoleKey)
        : new MemoryRaceStore();
  }
  return globalStore.__raceStore;
}
