import "server-only";

import type {
  CityResult,
  Race,
  RaceFilters,
  RaceListResult,
  RaceSubmission,
  RunClub,
  RunClubFilters,
  RunClubListResult,
  RunClubSubmission,
} from "@/lib/types";

/**
 * Data store interface. The rest of the server code only talks to this, so
 * the database access it hides — currently Prisma, in `prisma-store.ts` —
 * can be replaced by implementing this interface and changing the one
 * construction site in `index.ts`.
 */
export interface RaceStore {
  listRaces(filters: RaceFilters): Promise<RaceListResult>;
  getRace(id: string): Promise<Race | null>;
  /** Create a race. `submittedBy` is the id of the submitting user (null for system imports). */
  createRace(submission: RaceSubmission, submittedBy: string | null): Promise<Race>;
  /** Replace a race's editable fields. Returns null when the race doesn't exist. */
  updateRace(id: string, submission: RaceSubmission): Promise<Race | null>;
  /** Delete a race. Returns false when the race doesn't exist. */
  deleteRace(id: string): Promise<boolean>;
  /**
   * Find an existing race with the same name, date, and location
   * (city + country), case-insensitively. Used to reject duplicates.
   */
  findDuplicateRace(
    name: string,
    date: string,
    city: string,
    countryCode: string,
  ): Promise<Race | null>;
  /** Distinct cities (with their country) whose name matches `q`. */
  searchCities(q: string, limit: number): Promise<CityResult[]>;
  /** Get all race IDs saved by a user. */
  getUserRaceIds(userId: string): Promise<string[]>;
  /** Get full Race objects for a user's saved races. */
  getUserRaces(userId: string): Promise<Race[]>;
  /** Save a race to the user's list. */
  addUserRace(userId: string, raceId: string): Promise<void>;
  /** Remove a race from the user's list. */
  removeUserRace(userId: string, raceId: string): Promise<void>;
  /** List run clubs matching the filters, sorted by name. */
  listRunClubs(filters: RunClubFilters): Promise<RunClubListResult>;
  getRunClub(id: string): Promise<RunClub | null>;
  /** Create a run club owned by `ownerId` (the creating user). */
  createRunClub(submission: RunClubSubmission, ownerId: string): Promise<RunClub>;
  /** Replace a club's editable fields. Returns null when the club doesn't exist. */
  updateRunClub(id: string, submission: RunClubSubmission): Promise<RunClub | null>;
  /** Delete a run club. Returns false when the club doesn't exist. */
  deleteRunClub(id: string): Promise<boolean>;
}
