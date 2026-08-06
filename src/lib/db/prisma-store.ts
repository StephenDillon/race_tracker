import "server-only";

import { randomBytes } from "node:crypto";
import { countries, getCountryData, type TCountryCode } from "countries-list";
import { Prisma, type RtRace, type RtRunClub } from "@/generated/prisma/client";
import type {
  CityResult,
  ClubRun,
  EntryMethod,
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
import { getPrisma } from "./prisma";
import type { RaceStore } from "./store";

/**
 * Prisma-backed RaceStore — the only code that reads or writes this app's
 * tables. Server-side only; the connection (and the schema it targets) is
 * set up in prisma.ts.
 */

const RACE_KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RACE_KEY_LENGTH = 8;

/**
 * Short URL-friendly key for a race or club, generated on create — the id
 * columns have no DB default, so this is the only place ids come from.
 * 36^8 keys make random collisions vanishingly rare; creates still retry.
 */
function generateRaceKey(): string {
  return Array.from(
    randomBytes(RACE_KEY_LENGTH),
    (b) => RACE_KEY_ALPHABET[b % RACE_KEY_ALPHABET.length],
  ).join("");
}

/** How many times a create retries after a primary-key collision. */
const KEY_COLLISION_RETRIES = 3;

/**
 * Race dates are calendar dates with no timezone: a `date` column in
 * Postgres, a "YYYY-MM-DD" string in the API, and UTC midnight in between
 * (Prisma always reads and writes @db.Date at UTC midnight).
 */
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * Escape the wildcards Postgres LIKE gives meaning to, so a search for
 * "50%" looks for that text instead of matching everything. Prisma
 * parameterizes the value itself, so nothing here is about injection.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}

/** True when `error` is a unique violation on the named constraint/index. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some((t) => typeof t === "string" && t.includes(constraint));
}

/** True when Prisma reports "record not found" for an update or delete. */
function isNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

function rowToRace(row: RtRace): Race {
  return {
    id: row.id,
    name: row.name,
    date: toDateOnly(row.date),
    distances: row.distances as unknown as RaceDistance[],
    city: row.city,
    region: row.region,
    country: row.country,
    countryCode: row.countryCode,
    entryStatus: row.entryStatus as Race["entryStatus"],
    tags: row.tags,
    entryMethods: (row.entryMethods ?? []) as unknown as EntryMethod[],
    website: row.website ?? undefined,
    description: row.description ?? undefined,
    submittedBy: row.submittedBy ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Columns shared by race create and update, derived from a submission. */
function raceColumns(submission: RaceSubmission) {
  return {
    name: submission.name,
    date: fromDateOnly(submission.date),
    distances: submission.distances as unknown as Prisma.InputJsonValue,
    standardDistances: submission.distances
      .filter((d) => d.kind === "standard")
      .map((d) => d.distance),
    city: submission.city,
    region: submission.region,
    // The display name is always derived from the code, never trusted from
    // the client — countryCode is the canonical location field.
    country: getCountryData(submission.countryCode as TCountryCode).name,
    countryCode: submission.countryCode,
    entryStatus: submission.entryStatus,
    tags: submission.tags ?? [],
    entryMethods: (submission.entryMethods ??
      []) as unknown as Prisma.InputJsonValue,
    website: submission.website ?? null,
    description: submission.description ?? null,
  };
}

function rowToRunClub(row: RtRunClub): RunClub {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    region: row.region ?? undefined,
    country: row.country,
    countryCode: row.countryCode,
    address: row.address ?? undefined,
    website: row.website ?? undefined,
    runs: (row.runs ?? []) as unknown as ClubRun[],
    placeId: row.placeId ?? undefined,
    formattedAddress: row.formattedAddress ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Columns shared by club create and update, derived from a submission. */
function clubColumns(submission: RunClubSubmission) {
  return {
    name: submission.name,
    address: submission.address ?? null,
    city: submission.city,
    region: submission.region ?? null,
    country: getCountryData(submission.countryCode as TCountryCode).name,
    countryCode: submission.countryCode,
    website: submission.website ?? null,
    runs: (submission.runs ?? []) as unknown as Prisma.InputJsonValue,
    placeId: submission.placeId ?? null,
    formattedAddress: submission.formattedAddress ?? null,
    latitude: submission.latitude ?? null,
    longitude: submission.longitude ?? null,
  };
}

/** All ISO country codes belonging to any of the given continents. */
function continentCountryCodes(codes: string[]): string[] {
  return (Object.keys(countries) as TCountryCode[]).filter((code) =>
    codes.includes(countries[code].continent),
  );
}

export class PrismaRaceStore implements RaceStore {
  private get db() {
    return getPrisma();
  }

  async listRaces(filters: RaceFilters): Promise<RaceListResult> {
    const dateFrom = filters.dateFrom ?? new Date().toISOString().slice(0, 10);
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;

    const where: Prisma.RtRaceWhereInput = {
      date: {
        gte: fromDateOnly(dateFrom),
        ...(filters.dateTo ? { lte: fromDateOnly(filters.dateTo) } : {}),
      },
    };

    if (filters.distances?.length) {
      where.standardDistances = { hasSome: filters.distances };
    }

    const term = filters.q?.trim();
    if (term) {
      where.name = { contains: escapeLike(term), mode: "insensitive" };
    }

    // Location filters are OR-ed: continent selections expand to country
    // codes and merge with explicit countries; cities OR onto that.
    const codeSet = new Set<string>(filters.countryCodes ?? []);
    for (const code of continentCountryCodes(filters.continents ?? [])) {
      codeSet.add(code);
    }
    const codes = [...codeSet];
    const cities = filters.cities ?? [];
    if (codes.length > 0 && cities.length > 0) {
      where.OR = [{ countryCode: { in: codes } }, { city: { in: cities } }];
    } else if (codes.length > 0) {
      where.countryCode = { in: codes };
    } else if (cities.length > 0) {
      where.city = { in: cities };
    }

    if (filters.entryStatuses?.length) {
      where.entryStatus = { in: filters.entryStatuses };
    }

    if (filters.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }

    const [rows, total] = await this.db.$transaction([
      this.db.rtRace.findMany({
        where,
        orderBy: [{ date: "asc" }, { name: "asc" }],
        skip: offset,
        take: limit,
      }),
      this.db.rtRace.count({ where }),
    ]);

    return { races: rows.map(rowToRace), total };
  }

  async searchCities(q: string, limit: number): Promise<CityResult[]> {
    const term = q.trim();
    if (!term) return [];

    // Distinct cities, not distinct rows: several races share a city, so
    // over-fetch and fold them together rather than paging in the database.
    const rows = await this.db.rtRace.findMany({
      where: { city: { contains: escapeLike(term), mode: "insensitive" } },
      select: { city: true, country: true, countryCode: true },
      take: 200,
    });

    const seen = new Set<string>();
    const results: CityResult[] = [];
    for (const row of rows) {
      const key = `${row.city.toLowerCase()}|${row.countryCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(row);
    }
    return results.sort((a, b) => a.city.localeCompare(b.city)).slice(0, limit);
  }

  async getRace(id: string): Promise<Race | null> {
    const row = await this.db.rtRace.findUnique({ where: { id } });
    return row ? rowToRace(row) : null;
  }

  async findDuplicateRace(
    name: string,
    date: string,
    city: string,
    countryCode: string,
  ): Promise<Race | null> {
    const row = await this.db.rtRace.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        date: fromDateOnly(date),
        city: { equals: city, mode: "insensitive" },
        countryCode: countryCode.toUpperCase(),
      },
    });
    return row ? rowToRace(row) : null;
  }

  async createRace(
    submission: RaceSubmission,
    submittedBy: string | null,
  ): Promise<Race> {
    for (let attempt = 0; ; attempt++) {
      try {
        const row = await this.db.rtRace.create({
          data: {
            id: generateRaceKey(),
            ...raceColumns(submission),
            submittedBy,
          },
        });
        return rowToRace(row);
      } catch (error) {
        // A fresh key clears a primary-key collision. The dedup index is a
        // different matter — that one is a real conflict, reported as a 409
        // by the route, which matches on the index name below.
        if (
          isUniqueViolation(error, "races_pkey") &&
          attempt < KEY_COLLISION_RETRIES
        ) {
          continue;
        }
        if (isUniqueViolation(error, "races_dedup_idx")) {
          throw new Error(
            "Failed to create race: races_dedup_idx — a race with the " +
              "same name, date, and location already exists",
          );
        }
        throw error;
      }
    }
  }

  async updateRace(id: string, submission: RaceSubmission): Promise<Race | null> {
    try {
      const row = await this.db.rtRace.update({
        where: { id },
        data: raceColumns(submission),
      });
      return rowToRace(row);
    } catch (error) {
      if (isNotFound(error)) return null;
      if (isUniqueViolation(error, "races_dedup_idx")) {
        throw new Error(
          "Failed to update race: races_dedup_idx — a race with the " +
            "same name, date, and location already exists",
        );
      }
      throw error;
    }
  }

  async deleteRace(id: string): Promise<boolean> {
    try {
      await this.db.rtRace.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async getUserRaceIds(userId: string): Promise<string[]> {
    const rows = await this.db.rtUserRace.findMany({
      where: { userId },
      select: { raceId: true },
    });
    return rows.map((r) => r.raceId);
  }

  async getUserRaces(userId: string): Promise<Race[]> {
    const rows = await this.db.rtUserRace.findMany({
      where: { userId },
      include: { race: true },
      orderBy: { race: { date: "asc" } },
    });
    return rows.map((r) => rowToRace(r.race));
  }

  async addUserRace(userId: string, raceId: string): Promise<void> {
    await this.db.rtUserRace.upsert({
      where: { userId_raceId: { userId, raceId } },
      create: { userId, raceId },
      update: {},
    });
  }

  async removeUserRace(userId: string, raceId: string): Promise<void> {
    await this.db.rtUserRace.deleteMany({ where: { userId, raceId } });
  }

  async listRunClubs(filters: RunClubFilters): Promise<RunClubListResult> {
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;

    const where: Prisma.RtRunClubWhereInput = {};

    const name = filters.q?.trim();
    if (name) {
      where.name = { contains: escapeLike(name), mode: "insensitive" };
    }

    const location = filters.location?.trim();
    if (location) {
      const contains = escapeLike(location);
      where.OR = [
        { city: { contains, mode: "insensitive" } },
        { country: { contains, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await this.db.$transaction([
      this.db.rtRunClub.findMany({
        where,
        orderBy: { name: "asc" },
        skip: offset,
        take: limit,
      }),
      this.db.rtRunClub.count({ where }),
    ]);

    return { clubs: rows.map(rowToRunClub), total };
  }

  async getRunClub(id: string): Promise<RunClub | null> {
    const row = await this.db.rtRunClub.findUnique({ where: { id } });
    return row ? rowToRunClub(row) : null;
  }

  async createRunClub(
    submission: RunClubSubmission,
    ownerId: string,
  ): Promise<RunClub> {
    for (let attempt = 0; ; attempt++) {
      try {
        const row = await this.db.rtRunClub.create({
          data: { id: generateRaceKey(), ...clubColumns(submission), ownerId },
        });
        return rowToRunClub(row);
      } catch (error) {
        if (
          isUniqueViolation(error, "run_clubs_pkey") &&
          attempt < KEY_COLLISION_RETRIES
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  async updateRunClub(
    id: string,
    submission: RunClubSubmission,
  ): Promise<RunClub | null> {
    try {
      const row = await this.db.rtRunClub.update({
        where: { id },
        data: clubColumns(submission),
      });
      return rowToRunClub(row);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async deleteRunClub(id: string): Promise<boolean> {
    try {
      await this.db.rtRunClub.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}
