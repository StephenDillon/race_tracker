"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { continents, countries, type TCountryCode } from "countries-list";
import {
  ENTRY_STATUS_LABELS,
  ENTRY_STATUSES,
  STANDARD_DISTANCES,
  type ContinentCode,
  type EntryStatus,
  type Race,
  type RaceDistance,
  type StandardDistance,
} from "@/lib/types";

const PAGE_SIZE = 25;

interface FilterState {
  q: string;
  dateFrom: string;
  dateTo: string;
  distances: StandardDistance[];
  continent: "" | ContinentCode;
  country: string; // ISO code or ""
  entryStatuses: EntryStatus[];
  majorMarathon: "" | "true" | "false";
  majorQualifier: "" | "true" | "false";
}

const EMPTY_FILTERS: FilterState = {
  q: "",
  dateFrom: "",
  dateTo: "",
  distances: [],
  continent: "",
  country: "",
  entryStatuses: [],
  majorMarathon: "",
  majorQualifier: "",
};

const CONTINENT_OPTIONS = (
  Object.entries(continents) as [ContinentCode, string][]
).sort((a, b) => a[1].localeCompare(b[1]));

const ALL_COUNTRIES = (Object.keys(countries) as TCountryCode[])
  .map((code) => ({
    code,
    name: countries[code].name,
    continent: countries[code].continent,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function formatDistances(distances: RaceDistance[]): string {
  return distances
    .map((d) => (d.kind === "standard" ? d.distance : d.label))
    .join(", ");
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_STYLES: Record<EntryStatus, string> = {
  open: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  ballot: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  waitlist: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  invitation: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  sold_out: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
};

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function chipClass(active: boolean): string {
  return `rounded-full border px-2.5 py-1 text-xs ${
    active
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-zinc-300 hover:border-emerald-500 dark:border-zinc-700"
  }`;
}

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [races, setRaces] = useState<Race[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the text search so we don't hit the API on every keystroke.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const fetchRaces = useCallback(
    async (f: FilterState, q: string, pageOffset: number) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.distances.length) params.set("distances", f.distances.join(","));
      if (f.country) params.set("country", f.country);
      else if (f.continent) params.set("continent", f.continent);
      if (f.entryStatuses.length)
        params.set("entryStatuses", f.entryStatuses.join(","));
      if (f.majorMarathon) params.set("majorMarathon", f.majorMarathon);
      if (f.majorQualifier) params.set("majorQualifier", f.majorQualifier);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageOffset));

      try {
        const res = await fetch(`/api/races?${params.toString()}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: { races: Race[]; total: number } = await res.json();
        setRaces(data.races);
        setTotal(data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load races");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchRaces(filters, debouncedQ, offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fetchRaces,
    debouncedQ,
    filters.dateFrom,
    filters.dateTo,
    filters.distances,
    filters.continent,
    filters.country,
    filters.entryStatuses,
    filters.majorMarathon,
    filters.majorQualifier,
    offset,
  ]);

  const updateFilters = (patch: Partial<FilterState>) => {
    setOffset(0);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const toggleDistance = (d: StandardDistance) =>
    updateFilters({
      distances: filters.distances.includes(d)
        ? filters.distances.filter((x) => x !== d)
        : [...filters.distances, d],
    });

  const toggleEntryStatus = (s: EntryStatus) =>
    updateFilters({
      entryStatuses: filters.entryStatuses.includes(s)
        ? filters.entryStatuses.filter((x) => x !== s)
        : [...filters.entryStatuses, s],
    });

  const countryOptions = useMemo(
    () =>
      filters.continent
        ? ALL_COUNTRIES.filter((c) => c.continent === filters.continent)
        : ALL_COUNTRIES,
    [filters.continent],
  );

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-col gap-4">
          {/* Row 1: search + dates + location */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              type="search"
              placeholder="Search races by name…"
              value={filters.q}
              onChange={(e) => updateFilters({ q: e.target.value })}
              className={`${inputClass} lg:col-span-1`}
              aria-label="Search races by name"
            />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilters({ dateFrom: e.target.value })}
              className={inputClass}
              aria-label="From date"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilters({ dateTo: e.target.value })}
              className={inputClass}
              aria-label="To date"
            />
            <select
              value={filters.continent}
              onChange={(e) =>
                updateFilters({
                  continent: e.target.value as FilterState["continent"],
                  country: "",
                })
              }
              className={inputClass}
              aria-label="Continent"
            >
              <option value="">All continents</option>
              {CONTINENT_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={filters.country}
              onChange={(e) => updateFilters({ country: e.target.value })}
              className={inputClass}
              aria-label="Country"
            >
              <option value="">All countries</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: distance + entry chips + majors */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-zinc-500">
                Distance
              </span>
              {STANDARD_DISTANCES.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDistance(d)}
                  className={chipClass(filters.distances.includes(d))}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-zinc-500">
                Entry
              </span>
              {ENTRY_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleEntryStatus(s)}
                  className={chipClass(filters.entryStatuses.includes(s))}
                >
                  {ENTRY_STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.majorMarathon}
                onChange={(e) =>
                  updateFilters({
                    majorMarathon: e.target.value as FilterState["majorMarathon"],
                  })
                }
                className={inputClass}
                aria-label="Major marathon"
              >
                <option value="">Majors: any</option>
                <option value="true">Majors only</option>
                <option value="false">Exclude majors</option>
              </select>
              <select
                value={filters.majorQualifier}
                onChange={(e) =>
                  updateFilters({
                    majorQualifier: e.target.value as FilterState["majorQualifier"],
                  })
                }
                className={inputClass}
                aria-label="Major qualifier"
              >
                <option value="">Qualifiers: any</option>
                <option value="true">Qualifiers only</option>
                <option value="false">Exclude qualifiers</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setOffset(0);
                    setFilters(EMPTY_FILTERS);
                  }}
                  className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Upcoming races</h1>
          {!loading && !error && (
            <span className="text-sm text-zinc-500">
              {total} race{total === 1 ? "" : "s"} found
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        {!error && (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Race</th>
                  <th className="px-4 py-3">Distances</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Major</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      Loading races…
                    </td>
                  </tr>
                ) : races.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No races match your filters.
                    </td>
                  </tr>
                ) : (
                  races.map((race) => (
                    <tr
                      key={race.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(race.date)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {race.website ? (
                          <a
                            href={race.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-emerald-600 hover:underline dark:hover:text-emerald-400"
                          >
                            {race.name}
                          </a>
                        ) : (
                          race.name
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDistances(race.distances)}</td>
                      <td className="px-4 py-3">
                        {race.city}, {race.country}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[race.entryStatus]}`}
                        >
                          {ENTRY_STATUS_LABELS[race.entryStatus]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {race.isMajorMarathon && (
                          <span title="World Marathon Major">🌟 Major</span>
                        )}
                        {race.isMajorMarathon && race.isMajorQualifier && " · "}
                        {race.isMajorQualifier && (
                          <span title="Major qualifier course">✅ Qualifier</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
            >
              Previous
            </button>
            <span className="text-zinc-500">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
