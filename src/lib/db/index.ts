import "server-only";

import { PrismaRaceStore } from "./prisma-store";
import type { RaceStore } from "./store";

/**
 * Single entry point to the data layer. Server-side only — the `server-only`
 * import makes any accidental client-side import a build error, keeping
 * database access (and the connection string) off the client.
 *
 * Requires DATABASE_URL; DB_SCHEMA picks the Postgres schema (see
 * connection.ts). The store is cached on globalThis so the underlying
 * Prisma client and its pool are reused across requests.
 */
const globalStore = globalThis as unknown as { __raceStore?: RaceStore };

export function getRaceStore(): RaceStore {
  if (!globalStore.__raceStore) {
    globalStore.__raceStore = new PrismaRaceStore();
  }
  return globalStore.__raceStore;
}
