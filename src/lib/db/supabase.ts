import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  EntryStatus,
  Race,
  RaceDistance,
  RaceFilters,
  RaceListResult,
  RaceSubmission,
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

interface RtRaceRow {
  id: string;
  name: string;
  date: string;
  distances: RaceDistance[];
  standard_distances: string[];
  city: string;
  region: string;
  country: string;
  entry_status: EntryStatus;
  is_major_marathon: boolean;
  is_major_qualifier: boolean;
  website: string | null;
  description: string | null;
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
    entryStatus: row.entry_status,
    isMajorMarathon: row.is_major_marathon,
    isMajorQualifier: row.is_major_qualifier,
    website: row.website ?? undefined,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

/** Strip characters that would break PostgREST or() / ilike filter syntax. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%\\]/g, " ").trim();
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

    if (filters.location?.trim()) {
      const term = sanitizeSearchTerm(filters.location);
      if (term) {
        query = query.or(
          `city.ilike.%${term}%,region.ilike.%${term}%,country.ilike.%${term}%`,
        );
      }
    }

    if (filters.entryStatuses && filters.entryStatuses.length > 0) {
      query = query.in("entry_status", filters.entryStatuses);
    }

    if (filters.majorMarathon !== undefined) {
      query = query.eq("is_major_marathon", filters.majorMarathon);
    }
    if (filters.majorQualifier !== undefined) {
      query = query.eq("is_major_qualifier", filters.majorQualifier);
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

  async getRace(id: string): Promise<Race | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get race: ${error.message}`);
    return data ? rowToRace(data as RtRaceRow) : null;
  }

  async createRace(submission: RaceSubmission): Promise<Race> {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        name: submission.name,
        date: submission.date,
        distances: submission.distances,
        standard_distances: submission.distances
          .filter((d) => d.kind === "standard")
          .map((d) => d.distance),
        city: submission.city,
        region: submission.region,
        country: submission.country,
        entry_status: submission.entryStatus,
        is_major_marathon: submission.isMajorMarathon,
        is_major_qualifier: submission.isMajorQualifier,
        website: submission.website ?? null,
        description: submission.description ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create race: ${error.message}`);
    return rowToRace(data as RtRaceRow);
  }
}
