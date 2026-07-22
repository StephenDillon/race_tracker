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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronDownIcon } from "lucide-react";

const PAGE_SIZE = 25;

// Radix Select items cannot have an empty-string value, so "any" stands in
// for the unset state everywhere a select is optional.
const ANY = "any";

interface FilterState {
  q: string;
  dateFrom: string;
  dateTo: string;
  // Year/month quick picks — UI sugar that fills dateFrom/dateTo.
  year: string;
  month: string; // "1"–"12"
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
  year: "",
  month: "",
  distances: [],
  continent: "",
  country: "",
  entryStatuses: [],
  majorMarathon: "",
  majorQualifier: "",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2].map(
  String,
);

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString(undefined, { month: "long" }),
}));

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Date range covered by a year/month pick; month "" means the whole year.
function rangeFor(year: string, month: string): { dateFrom: string; dateTo: string } {
  const y = Number(year);
  if (!month) return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  const m = Number(month);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    dateFrom: `${y}-${pad2(m)}-01`,
    dateTo: `${y}-${pad2(m)}-${lastDay}`,
  };
}

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

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border p-3">
      <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </legend>
      {children}
    </fieldset>
  );
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
      <Card>
        <CardContent className="flex flex-col gap-4">
          {/* Search row */}
          <div className="flex items-center gap-3">
            <Input
              type="search"
              placeholder="Search races by name…"
              value={filters.q}
              onChange={(e) => updateFilters({ q: e.target.value })}
              className="flex-1"
              aria-label="Search races by name"
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOffset(0);
                  setFilters(EMPTY_FILTERS);
                }}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Filter groups */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <FilterGroup label="Distance">
              <ToggleGroup
                type="multiple"
                variant="outline"
                size="sm"
                spacing={1}
                className="flex-wrap"
                value={filters.distances}
                onValueChange={(v) =>
                  updateFilters({ distances: v as StandardDistance[] })
                }
              >
                {STANDARD_DISTANCES.map((d) => (
                  <ToggleGroupItem key={d} value={d}>
                    {d}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FilterGroup>

            <FilterGroup label="Location">
              <div className="flex flex-col gap-2">
                <Select
                  value={filters.continent || ANY}
                  onValueChange={(v) =>
                    updateFilters({
                      continent:
                        v === ANY ? "" : (v as FilterState["continent"]),
                      country: "",
                    })
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Continent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>All continents</SelectItem>
                    {CONTINENT_OPTIONS.map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.country || ANY}
                  onValueChange={(v) =>
                    updateFilters({ country: v === ANY ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>All countries</SelectItem>
                    {countryOptions.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FilterGroup>

            <FilterGroup label="Entry">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                    aria-label="Entry types"
                  >
                    {filters.entryStatuses.length === 0
                      ? "All entry types"
                      : filters.entryStatuses.length === 1
                        ? ENTRY_STATUS_LABELS[filters.entryStatuses[0]]
                        : `${filters.entryStatuses.length} entry types`}
                    <ChevronDownIcon className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start">
                  {ENTRY_STATUSES.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={filters.entryStatuses.includes(s)}
                      onCheckedChange={(checked) =>
                        updateFilters({
                          entryStatuses: checked
                            ? [...filters.entryStatuses, s]
                            : filters.entryStatuses.filter((x) => x !== s),
                        })
                      }
                      // Keep the menu open while picking multiple statuses.
                      onSelect={(e) => e.preventDefault()}
                    >
                      {ENTRY_STATUS_LABELS[s]}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </FilterGroup>

            <FilterGroup label="Dates">
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={filters.year || ANY}
                    onValueChange={(v) => {
                      if (v === ANY) {
                        updateFilters({
                          year: "",
                          month: "",
                          dateFrom: "",
                          dateTo: "",
                        });
                      } else {
                        updateFilters({
                          year: v,
                          ...rangeFor(v, filters.month),
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label="Year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any year</SelectItem>
                      {YEAR_OPTIONS.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.month || ANY}
                    disabled={!filters.year}
                    onValueChange={(v) => {
                      const month = v === ANY ? "" : v;
                      updateFilters({
                        month,
                        ...rangeFor(filters.year, month),
                      });
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label="Month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any month</SelectItem>
                      {MONTH_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From</span>
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) =>
                        updateFilters({
                          dateFrom: e.target.value,
                          year: "",
                          month: "",
                        })
                      }
                      aria-label="From date"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To</span>
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) =>
                        updateFilters({
                          dateTo: e.target.value,
                          year: "",
                          month: "",
                        })
                      }
                      aria-label="To date"
                    />
                  </label>
                </div>
              </div>
            </FilterGroup>

            <FilterGroup label="Additional">
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={filters.majorMarathon || ANY}
                    onValueChange={(v) =>
                      updateFilters({
                        majorMarathon:
                          v === ANY ? "" : (v as FilterState["majorMarathon"]),
                      })
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Major marathon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Majors: any</SelectItem>
                      <SelectItem value="true">Majors only</SelectItem>
                      <SelectItem value="false">Exclude majors</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.majorQualifier || ANY}
                    onValueChange={(v) =>
                      updateFilters({
                        majorQualifier:
                          v === ANY ? "" : (v as FilterState["majorQualifier"]),
                      })
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Major qualifier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Qualifiers: any</SelectItem>
                      <SelectItem value="true">Qualifiers only</SelectItem>
                      <SelectItem value="false">Exclude qualifiers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FilterGroup>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Upcoming races</h1>
          {!loading && !error && (
            <span className="text-sm text-muted-foreground">
              {total} race{total === 1 ? "" : "s"} found
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Race</TableHead>
                  <TableHead>Distances</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Major</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Loading races…
                    </TableCell>
                  </TableRow>
                ) : races.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No races match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  races.map((race) => (
                    <TableRow key={race.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(race.date)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {race.website ? (
                          <a
                            href={race.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary hover:underline"
                          >
                            {race.name}
                          </a>
                        ) : (
                          race.name
                        )}
                      </TableCell>
                      <TableCell>{formatDistances(race.distances)}</TableCell>
                      <TableCell>
                        {race.city}, {race.country}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_STYLES[race.entryStatus]}
                        >
                          {ENTRY_STATUS_LABELS[race.entryStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {race.isMajorMarathon && (
                          <span title="World Marathon Major">🌟 Major</span>
                        )}
                        {race.isMajorMarathon && race.isMajorQualifier && " · "}
                        {race.isMajorQualifier && (
                          <span title="Major qualifier course">✅ Qualifier</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && !error && total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <span className="text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
