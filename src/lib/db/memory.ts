import "server-only";

import { randomUUID } from "crypto";
import { countries, type TCountryCode } from "countries-list";
import type {
  Race,
  RaceFilters,
  RaceListResult,
  RaceSubmission,
} from "@/lib/types";
import type { RaceStore } from "./store";
import { SEED_RACES } from "./seed";

/**
 * In-memory RaceStore. Placeholder until Supabase credentials are provided —
 * data resets on every server restart / cold start, which is fine for now.
 */
export class MemoryRaceStore implements RaceStore {
  private races: Race[];

  constructor(seed: Race[] = SEED_RACES) {
    this.races = [...seed];
  }

  async listRaces(filters: RaceFilters): Promise<RaceListResult> {
    const dateFrom = filters.dateFrom ?? new Date().toISOString().slice(0, 10);
    const q = filters.q?.trim().toLowerCase();

    const matches = this.races
      .filter((race) => {
        if (race.date < dateFrom) return false;
        if (filters.dateTo && race.date > filters.dateTo) return false;

        if (q && !race.name.toLowerCase().includes(q)) return false;

        if (filters.distances && filters.distances.length > 0) {
          const hasDistance = race.distances.some(
            (d) =>
              d.kind === "standard" && filters.distances!.includes(d.distance),
          );
          if (!hasDistance) return false;
        }

        if (filters.countryCode) {
          if (race.countryCode !== filters.countryCode) return false;
        } else if (filters.continent) {
          const country = countries[race.countryCode as TCountryCode];
          if (country?.continent !== filters.continent) return false;
        }

        if (
          filters.entryStatuses &&
          filters.entryStatuses.length > 0 &&
          !filters.entryStatuses.includes(race.entryStatus)
        ) {
          return false;
        }

        if (
          filters.majorMarathon !== undefined &&
          race.isMajorMarathon !== filters.majorMarathon
        ) {
          return false;
        }

        if (
          filters.majorQualifier !== undefined &&
          race.isMajorQualifier !== filters.majorQualifier
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;

    return {
      races: matches.slice(offset, offset + limit),
      total: matches.length,
    };
  }

  async getRace(id: string): Promise<Race | null> {
    return this.races.find((race) => race.id === id) ?? null;
  }

  async createRace(submission: RaceSubmission): Promise<Race> {
    const race: Race = {
      ...submission,
      country:
        countries[submission.countryCode as TCountryCode]?.name ??
        submission.countryCode,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.races.push(race);
    return race;
  }
}
