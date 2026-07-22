import "server-only";

import type { RaceStore } from "./store";
import { SupabaseRaceStore } from "./supabase";

/**
 * Single entry point to the data layer. Server-side only — the `server-only`
 * import makes any accidental client-side import a build error, keeping
 * database access (and Supabase keys) off the client.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.
 * The store is cached on globalThis so the client is reused across requests.
 */
const globalStore = globalThis as unknown as { __raceStore?: RaceStore };

export function getRaceStore(): RaceStore {
  if (!globalStore.__raceStore) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
      );
    }
    globalStore.__raceStore = new SupabaseRaceStore(url, serviceRoleKey);
  }
  return globalStore.__raceStore;
}
