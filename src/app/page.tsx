"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ENTRY_STATUS_LABELS,
  ENTRY_STATUSES,
  STANDARD_DISTANCES,
  type EntryStatus,
  type Race,
  type RaceDistance,
  type StandardDistance,
} from "@/lib/types";

const PAGE_SIZE = 25;

interface FilterState {
  dateFrom: string;
  dateTo: string;
  distances: StandardDistance[];
  location: string;
  entryStatuses: EntryStatus[];
  majorMarathon: "" | "true" | "false";
  majorQualifier: "" | "true" | "false";
}

const EMPTY_FILTERS: FilterState = {
  dateFrom: "",
  dateTo: "",
  distances: [],
  location: "",
  entryStatuses: [],
  majorMarathon: "",
  majorQualifier: "",
};

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

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [races, setRaces] = useState<Race[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRaces = useCallback(async (f: FilterState, pageOffset: number) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    if (f.dateTo) params.set("dateTo", f.dateTo);
    if (f.distances.length) params.set("distances", f.distances.join(","));
    if (f.location.trim()) params.set("location", f.location.trim());
    if (f.entryStatuses.length) params.set("entryStatuses", f.entryStatuses.join(","));
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
  }, []);

  useEffect(() => {
    fetchRaces(filters, offset);
  }, [fetchRaces, filters, offset]);

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

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Filter panel */}
      <aside className="w-full shrink-0 lg:w-72">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Filters</h2>
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

          <div className="flex flex-col gap-5 text-sm">
            <fieldset>
              <legend className="mb-2 font-medium">Dates</legend>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">From</span>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                    className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">To</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilters({ dateTo: e.target.value })}
                    className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 font-medium">Distance</legend>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_DISTANCES.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDistance(d)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      filters.distances.includes(d)
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-zinc-300 hover:border-emerald-500 dark:border-zinc-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 font-medium">Location</legend>
              <input
                type="text"
                placeholder="City, region, or country"
                value={filters.location}
                onChange={(e) => updateFilters({ location: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>

            <fieldset>
              <legend className="mb-2 font-medium">Entry criteria</legend>
              <div className="flex flex-col gap-1.5">
                {ENTRY_STATUSES.map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.entryStatuses.includes(s)}
                      onChange={() => toggleEntryStatus(s)}
                      className="accent-emerald-600"
                    />
                    {ENTRY_STATUS_LABELS[s]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 font-medium">Majors</legend>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">Major marathon</span>
                  <select
                    value={filters.majorMarathon}
                    onChange={(e) =>
                      updateFilters({
                        majorMarathon: e.target.value as FilterState["majorMarathon"],
                      })
                    }
                    className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Any</option>
                    <option value="true">Majors only</option>
                    <option value="false">Exclude majors</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">Major qualifier</span>
                  <select
                    value={filters.majorQualifier}
                    onChange={(e) =>
                      updateFilters({
                        majorQualifier: e.target.value as FilterState["majorQualifier"],
                      })
                    }
                    className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Any</option>
                    <option value="true">Qualifiers only</option>
                    <option value="false">Exclude qualifiers</option>
                  </select>
                </label>
              </div>
            </fieldset>
          </div>
        </div>
      </aside>

      {/* Results */}
      <section className="min-w-0 flex-1">
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
