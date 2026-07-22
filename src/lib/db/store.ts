import "server-only";

import type {
  CityResult,
  Race,
  RaceFilters,
  RaceListResult,
  RaceSubmission,
} from "@/lib/types";

/**
 * Data store interface. The rest of the server code only talks to this,
 * so swapping the in-memory implementation for Supabase later means
 * implementing this interface with the Supabase client (using server-side
 * env vars) and changing the export in `index.ts` — nothing else.
 */
export interface RaceStore {
  listRaces(filters: RaceFilters): Promise<RaceListResult>;
  getRace(id: string): Promise<Race | null>;
  createRace(submission: RaceSubmission): Promise<Race>;
  /** Distinct cities (with their country) whose name matches `q`. */
  searchCities(q: string, limit: number): Promise<CityResult[]>;
}
