import "server-only";

import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { countries, getCountryData, type TCountryCode } from "countries-list";
import type {
  CityResult,
  ClubRun,
  EntryMethod,
  EntryStatus,
  Race,
  RaceDistance,
  RaceFilters,
  RaceListResult,
  RaceSubmission,
  RunClub,
  RunClubFilters,
  RunClubListResult,
  RunClubSubmission,
} from "@/lib/types";
import type { RaceStore } from "./store";

/**
 * Supabase-backed RaceStore. Runs server-side only, using the service role
 * key — RLS is enabled on rt_ tables with no policies, so this backend is
 * the only thing that can touch them.
 *
 * All tables in this project are prefixed with rt_ (see supabase/migrations).
 */

const TABLE = "rt_races";
const CLUBS_TABLE = "rt_run_clubs";

const RACE_KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RACE_KEY_LENGTH = 8;

/**
 * Short URL-friendly race key, generated server-side on create (the id
 * column has no DB default — see migration 0007). 36^8 keys make random
 * collisions vanishingly rare; createRace still retries on one.
 */
function generateRaceKey(): string {
  return Array.from(
    randomBytes(RACE_KEY_LENGTH),
    (b) => RACE_KEY_ALPHABET[b % RACE_KEY_ALPHABET.length],
  ).join("");
}

interface RtRaceRow {
  id: string;
  name: string;
  date: string;
  distances: RaceDistance[];
  standard_distances: string[];
  city: string;
  region: string;
  country: string;
  country_code: string;
  entry_status: EntryStatus;
  tags: string[];
  entry_methods: EntryMethod[] | null;
  website: string | null;
  description: string | null;
  submitted_by: string | null;
  created_at: string;
}

function rowToRace(row: RtRaceRow): Race {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    distances: row.distances,
    city: row.city,
    region: row.region,
    country: row.country,
    countryCode: row.country_code,
    entryStatus: row.entry_status,
    tags: row.tags ?? [],
    entryMethods: row.entry_methods ?? [],
    website: row.website ?? undefined,
    description: row.description ?? undefined,
    submittedBy: row.submitted_by ?? null,
    createdAt: row.created_at,
  };
}

/** Columns shared by create and update, derived from a submission. */
function submissionColumns(submission: RaceSubmission) {
  return {
    name: submission.name,
    date: submission.date,
    distances: submission.distances,
    standard_distances: submission.distances
      .filter((d) => d.kind === "standard")
      .map((d) => d.distance),
    city: submission.city,
    region: submission.region,
    country: getCountryData(submission.countryCode as TCountryCode).name,
    country_code: submission.countryCode,
    entry_status: submission.entryStatus,
    tags: submission.tags ?? [],
    entry_methods: submission.entryMethods ?? [],
    website: submission.website ?? null,
    description: submission.description ?? null,
  };
}

interface RtRunClubRow {
  id: string;
  name: string;
  address: string | null;
  city: string;
  region: string | null;
  country: string;
  country_code: string;
  website: string | null;
  runs: ClubRun[];
  place_id: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_id: string;
  created_at: string;
}

function rowToRunClub(row: RtRunClubRow): RunClub {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    region: row.region ?? undefined,
    country: row.country,
    countryCode: row.country_code,
    address: row.address ?? undefined,
    website: row.website ?? undefined,
    runs: row.runs ?? [],
    placeId: row.place_id ?? undefined,
    formattedAddress: row.formatted_address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  };
}

/** Columns shared by club create and update, derived from a submission. */
function clubSubmissionColumns(submission: RunClubSubmission) {
  return {
    name: submission.name,
    address: submission.address ?? null,
    city: submission.city,
    region: submission.region ?? null,
    country: getCountryData(submission.countryCode as TCountryCode).name,
    country_code: submission.countryCode,
    website: submission.website ?? null,
    runs: submission.runs ?? [],
    place_id: submission.placeId ?? null,
    formatted_address: submission.formattedAddress ?? null,
    latitude: submission.latitude ?? null,
    longitude: submission.longitude ?? null,
  };
}

/** Strip characters that carry meaning in PostgREST ilike patterns. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%\\]/g, " ").trim();
}

/** All ISO country codes belonging to any of the given continents. */
function continentCountryCodes(codes: string[]): string[] {
  return (Object.keys(countries) as TCountryCode[]).filter((code) =>
    codes.includes(countries[code].continent),
  );
}

export class SupabaseRaceStore implements RaceStore {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async listRaces(filters: RaceFilters): Promise<RaceListResult> {
    const dateFrom = filters.dateFrom ?? new Date().toISOString().slice(0, 10);
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;

    let query = this.client
      .from(TABLE)
      .select("*", { count: "exact" })
      .gte("date", dateFrom);

    if (filters.dateTo) query = query.lte("date", filters.dateTo);

    if (filters.distances && filters.distances.length > 0) {
      query = query.overlaps("standard_distances", filters.distances);
    }

    if (filters.q?.trim()) {
      const term = sanitizeSearchTerm(filters.q);
      if (term) query = query.ilike("name", `%${term}%`);
    }

    // Location filters are OR-ed: continent selections expand to country
    // codes and merge with explicit countries; cities OR onto that.
    const codeSet = new Set<string>(filters.countryCodes ?? []);
    if (filters.continents && filters.continents.length > 0) {
      for (const code of continentCountryCodes(filters.continents)) {
        codeSet.add(code);
      }
    }
    const codes = [...codeSet];
    // PostgREST `or` strings are comma/paren delimited, so strip those from
    // user-supplied city names; quote each value to survive spaces.
    const cities = (filters.cities ?? []).map(
      (c) => `"${c.replace(/[,()"\\]/g, " ").trim()}"`,
    );
    if (codes.length > 0 && cities.length > 0) {
      query = query.or(
        `country_code.in.(${codes.join(",")}),city.in.(${cities.join(",")})`,
      );
    } else if (codes.length > 0) {
      query = query.in("country_code", codes);
    } else if (cities.length > 0) {
      query = query.or(`city.in.(${cities.join(",")})`);
    }

    if (filters.entryStatuses && filters.entryStatuses.length > 0) {
      query = query.in("entry_status", filters.entryStatuses);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps("tags", filters.tags);
    }

    const { data, error, count } = await query
      .order("date", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to list races: ${error.message}`);

    return {
      races: (data as RtRaceRow[]).map(rowToRace),
      total: count ?? 0,
    };
  }

  async searchCities(q: string, limit: number): Promise<CityResult[]> {
    const term = sanitizeSearchTerm(q);
    if (!term) return [];

    const { data, error } = await this.client
      .from(TABLE)
      .select("city, country, country_code")
      .ilike("city", `%${term}%`)
      .limit(200);

    if (error) throw new Error(`Failed to search cities: ${error.message}`);

    const seen = new Set<string>();
    const results: CityResult[] = [];
    for (const row of data as Pick<RtRaceRow, "city" | "country" | "country_code">[]) {
      const key = `${row.city.toLowerCase()}|${row.country_code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        city: row.city,
        country: row.country,
        countryCode: row.country_code,
      });
    }
    return results
      .sort((a, b) => a.city.localeCompare(b.city))
      .slice(0, limit);
  }

  async getRace(id: string): Promise<Race | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get race: ${error.message}`);
    return data ? rowToRace(data as RtRaceRow) : null;
  }

  async findDuplicateRace(
    name: string,
    date: string,
    city: string,
    countryCode: string,
  ): Promise<Race | null> {
    // ilike with all wildcards escaped = case-insensitive equality.
    const exact = (s: string) => s.replace(/([\\%_])/g, "\\$1");
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .ilike("name", exact(name))
      .eq("date", date)
      .ilike("city", exact(city))
      .eq("country_code", countryCode.toUpperCase())
      .limit(1);

    if (error) throw new Error(`Failed to check for duplicate race: ${error.message}`);
    const rows = data as RtRaceRow[];
    return rows.length > 0 ? rowToRace(rows[0]) : null;
  }

  async createRace(
    submission: RaceSubmission,
    submittedBy: string | null,
  ): Promise<Race> {
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await this.client
        .from(TABLE)
        .insert({
          id: generateRaceKey(),
          ...submissionColumns(submission),
          submitted_by: submittedBy,
        })
        .select()
        .single();

      if (!error) return rowToRace(data as RtRaceRow);
      // Primary-key collision: generate a fresh key and retry. Any other
      // error (including the dedup index) propagates to the route.
      if (
        error.code === "23505" &&
        error.message.includes("rt_races_pkey") &&
        attempt < 3
      ) {
        continue;
      }
      throw new Error(`Failed to create race: ${error.message}`);
    }
  }

  async updateRace(id: string, submission: RaceSubmission): Promise<Race | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .update(submissionColumns(submission))
      .eq("id", id)
      .select();

    if (error) throw new Error(`Failed to update race: ${error.message}`);
    const rows = data as RtRaceRow[];
    return rows.length > 0 ? rowToRace(rows[0]) : null;
  }

  async deleteRace(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw new Error(`Failed to delete race: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }

  async getUserRaceIds(userId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from("rt_user_races")
      .select("race_id")
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to get user races: ${error.message}`);
    return (data as { race_id: string }[]).map((r) => r.race_id);
  }

  async getUserRaces(userId: string): Promise<Race[]> {
    const ids = await this.getUserRaceIds(userId);
    if (ids.length === 0) return [];

    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .in("id", ids)
      .order("date", { ascending: true });

    if (error) throw new Error(`Failed to get user races: ${error.message}`);
    return (data as RtRaceRow[]).map(rowToRace);
  }

  async addUserRace(userId: string, raceId: string): Promise<void> {
    const { error } = await this.client
      .from("rt_user_races")
      .upsert({ user_id: userId, race_id: raceId });

    if (error) throw new Error(`Failed to add user race: ${error.message}`);
  }

  async removeUserRace(userId: string, raceId: string): Promise<void> {
    const { error } = await this.client
      .from("rt_user_races")
      .delete()
      .eq("user_id", userId)
      .eq("race_id", raceId);

    if (error) throw new Error(`Failed to remove user race: ${error.message}`);
  }

  async listRunClubs(filters: RunClubFilters): Promise<RunClubListResult> {
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;

    let query = this.client
      .from(CLUBS_TABLE)
      .select("*", { count: "exact" });

    if (filters.q?.trim()) {
      const term = sanitizeSearchTerm(filters.q);
      if (term) query = query.ilike("name", `%${term}%`);
    }

    if (filters.location?.trim()) {
      const term = sanitizeSearchTerm(filters.location);
      if (term) {
        query = query.or(`city.ilike.%${term}%,country.ilike.%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to list run clubs: ${error.message}`);

    return {
      clubs: (data as RtRunClubRow[]).map(rowToRunClub),
      total: count ?? 0,
    };
  }

  async getRunClub(id: string): Promise<RunClub | null> {
    const { data, error } = await this.client
      .from(CLUBS_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get run club: ${error.message}`);
    return data ? rowToRunClub(data as RtRunClubRow) : null;
  }

  async createRunClub(
    submission: RunClubSubmission,
    ownerId: string,
  ): Promise<RunClub> {
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await this.client
        .from(CLUBS_TABLE)
        .insert({
          id: generateRaceKey(),
          ...clubSubmissionColumns(submission),
          owner_id: ownerId,
        })
        .select()
        .single();

      if (!error) return rowToRunClub(data as RtRunClubRow);
      if (
        error.code === "23505" &&
        error.message.includes("rt_run_clubs_pkey") &&
        attempt < 3
      ) {
        continue;
      }
      throw new Error(`Failed to create run club: ${error.message}`);
    }
  }

  async updateRunClub(
    id: string,
    submission: RunClubSubmission,
  ): Promise<RunClub | null> {
    const { data, error } = await this.client
      .from(CLUBS_TABLE)
      .update(clubSubmissionColumns(submission))
      .eq("id", id)
      .select();

    if (error) throw new Error(`Failed to update run club: ${error.message}`);
    const rows = data as RtRunClubRow[];
    return rows.length > 0 ? rowToRunClub(rows[0]) : null;
  }

  async deleteRunClub(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(CLUBS_TABLE)
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw new Error(`Failed to delete run club: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
}
