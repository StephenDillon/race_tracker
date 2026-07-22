/**
 * Core domain types for the race finder.
 * Shared between server (data layer, API routes) and client (UI).
 * Keep this file free of any server-only imports.
 */

/** Standard, well-known running distances. */
export const STANDARD_DISTANCES = [
  "5K",
  "10K",
  "Half Marathon",
  "Marathon",
  "50K",
  "50 Mile",
  "100K",
  "100 Mile",
] as const;

export type StandardDistance = (typeof STANDARD_DISTANCES)[number];

/** A race distance is either a standard distance or a custom one (e.g. "7.7K trail loop"). */
export type RaceDistance =
  | { kind: "standard"; distance: StandardDistance }
  | { kind: "custom"; label: string; kilometers: number };

export const ENTRY_STATUSES = [
  "open",
  "closed",
  "ballot",
  "waitlist",
  "invitation",
  "sold_out",
] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  open: "Open registration",
  closed: "Closed",
  ballot: "Ballot / Lottery",
  waitlist: "Waitlist",
  invitation: "Invitation only",
  sold_out: "Sold out",
};

export interface Race {
  id: string;
  name: string;
  /** ISO date (YYYY-MM-DD) of race day. */
  date: string;
  distances: RaceDistance[];
  city: string;
  region: string; // state / province / county, free text
  /** Display name derived from countryCode (e.g. "United States"). */
  country: string;
  /** ISO 3166-1 alpha-2 code (e.g. "US"). Canonical location field for filtering. */
  countryCode: string;
  entryStatus: EntryStatus;
  /** One of the World Marathon Majors (Boston, London, Berlin, Chicago, NYC, Tokyo, Sydney). */
  isMajorMarathon: boolean;
  /** Results can be used to qualify for a major (e.g. Boston Qualifier certified course). */
  isMajorQualifier: boolean;
  website?: string;
  description?: string;
  /** Set by the server on submission. */
  createdAt: string;
}

/** Payload accepted when someone submits a race. `country` is derived server-side from `countryCode`. */
export type RaceSubmission = Omit<Race, "id" | "createdAt" | "country">;

/** Continent codes as used by countries-list (AF, AN, AS, EU, NA, OC, SA). */
export type ContinentCode = "AF" | "AN" | "AS" | "EU" | "NA" | "OC" | "SA";

/** Filters accepted by the race listing API. All optional; combined with AND. */
export interface RaceFilters {
  /** Free-text search on race name. */
  q?: string;
  /** Races on or after this ISO date. Defaults to today ("upcoming"). */
  dateFrom?: string;
  /** Races on or before this ISO date. */
  dateTo?: string;
  /** Match any of these standard distances. */
  distances?: StandardDistance[];
  /** Filter to a continent (ignored when countryCode is set). */
  continent?: ContinentCode;
  /** Filter to a single country (ISO 3166-1 alpha-2). */
  countryCode?: string;
  /** Match any of these entry statuses. */
  entryStatuses?: EntryStatus[];
  majorMarathon?: boolean;
  majorQualifier?: boolean;
  /** Max results per page. Defaults to 25 on the main page. */
  limit?: number;
  offset?: number;
}

export interface RaceListResult {
  races: Race[];
  total: number;
}
