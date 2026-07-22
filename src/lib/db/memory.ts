import "server-only";

import { randomUUID } from "crypto";
import { countries, type TCountryCode } from "countries-list";
import type {
  CityResult,
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

        const hasLocationFilter =
          (filters.continents?.length ?? 0) > 0 ||
          (filters.countryCodes?.length ?? 0) > 0 ||
          (filters.cities?.length ?? 0) > 0;
        if (hasLocationFilter) {
          const continent =
            countries[race.countryCode as TCountryCode]?.continent;
          const matchesLocation =
            (continent && filters.continents?.includes(continent)) ||
            filters.countryCodes?.includes(race.countryCode) ||
            filters.cities?.some(
              (c) => c.toLowerCase() === race.city.toLowerCase(),
            );
          if (!matchesLocation) return false;
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

  async searchCities(q: string, limit: number): Promise<CityResult[]> {
    const term = q.trim().toLowerCase();
    if (!term) return [];

    const seen = new Set<string>();
    const results: CityResult[] = [];
    for (const race of this.races) {
      if (!race.city.toLowerCase().includes(term)) continue;
      const key = `${race.city.toLowerCase()}|${race.countryCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        city: race.city,
        country: race.country,
        countryCode: race.countryCode,
      });
    }
    return results
      .sort((a, b) => a.city.localeCompare(b.city))
      .slice(0, limit);
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
