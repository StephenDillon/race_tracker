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

/** A way to gain entry into a race (lottery, qualifier, charity, …). */
export interface EntryMethod {
  method: string;
  /** ISO date the window opens. */
  opens: string;
  /** ISO date the window closes. */
  closes: string;
}

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
  tags: string[];
  /** Ways to enter the race with their windows; mainly used for majors. */
  entryMethods: EntryMethod[];
  website?: string;
  description?: string;
  /** id of the user who submitted the race; null for seeded/legacy rows. */
  submittedBy: string | null;
  /** Set by the server on submission. */
  createdAt: string;
}

/** Payload accepted when someone submits or edits a race. `country` is derived server-side from `countryCode`. */
export type RaceSubmission = Omit<
  Race,
  "id" | "createdAt" | "country" | "submittedBy"
>;

export const ROLES = ["admin", "moderator", "user"] as const;

/**
 * RBAC role. Admins manage user roles and can do everything moderators can;
 * moderators edit/delete any race; users edit only races they submitted.
 */
export type Role = (typeof ROLES)[number];

/** A user account with its role, for the admin user-management page. */
export interface UserAccount {
  id: string;
  email: string | null;
  role: Role;
  createdAt: string;
}

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
  /**
   * Location filters. A race matches when it is in any selected continent OR
   * any selected country OR any selected city (the three lists are OR-ed).
   */
  continents?: ContinentCode[];
  /** ISO 3166-1 alpha-2 codes. */
  countryCodes?: string[];
  /** Exact city names (case-insensitive). */
  cities?: string[];
  /** Match any of these entry statuses. */
  entryStatuses?: EntryStatus[];
  tags?: string[];
  /** Max results per page. Defaults to 25 on the main page. */
  limit?: number;
  offset?: number;
}

export interface RaceListResult {
  races: Race[];
  total: number;
}

/**
 * Metadata about a REST API key, safe to send to the client. The key itself
 * is only ever returned once, at creation — the server stores just a hash.
 */
export interface ApiKeyMeta {
  id: string;
  name: string;
  /** First few characters of the key, for display (e.g. "rt_1a2b3c4d"). */
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

/** A distinct city that hosts at least one race, for location search. */
export interface CityResult {
  city: string;
  /** Display name, e.g. "Germany". */
  country: string;
  countryCode: string;
}
