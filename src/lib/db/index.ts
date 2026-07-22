import "server-only";

import type { RaceStore } from "./store";
import { MemoryRaceStore } from "./memory";

/**
 * Single entry point to the data layer. Server-side only — the `server-only`
 * import makes any accidental client-side import a build error, keeping
 * database access (and later, Supabase keys) off the client.
 *
 * When Supabase credentials are available, implement `RaceStore` with the
 * Supabase client (reading SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from
 * server env vars) and return it here instead.
 *
 * The store is cached on globalThis so submitted races survive Next.js
 * dev-server hot reloads within a single process.
 */
const globalStore = globalThis as unknown as { __raceStore?: RaceStore };

export function getRaceStore(): RaceStore {
  globalStore.__raceStore ??= new MemoryRaceStore();
  return globalStore.__raceStore;
}
