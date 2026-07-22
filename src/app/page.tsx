"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import type { CityResult } from "@/lib/types";

const PAGE_SIZE = 25;

// Radix Select items cannot have an empty-string value, so "any" stands in
// for the unset state everywhere a select is optional.
const ANY = "any";

/** One picked location filter: a continent, a country, or a city. */
interface LocationPick {
  kind: "continent" | "country" | "city";
  /** Continent code, ISO country code, or city name. */
  value: string;
  label: string;
}

interface FilterState {
  q: string;
  dateFrom: string;
  dateTo: string;
  // Year/month quick picks — UI sugar that fills dateFrom/dateTo.
  year: string;
  month: string; // "1"–"12"
  distances: StandardDistance[];
  locations: LocationPick[];
  entryStatuses: EntryStatus[];


}

const EMPTY_FILTERS: FilterState = {
  q: "",
  dateFrom: "",
  dateTo: "",
  year: "",
  month: "",
  distances: [],
  locations: [],
  entryStatuses: [],


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

/**
 * Search-driven location picker. Continents and countries are static lists;
 * cities are looked up from the race data as you type. Selections are chips
 * below the trigger and OR-combine in the filter.
 */
function LocationSearch({
  selected,
  onChange,
}: {
  selected: LocationPick[];
  onChange: (next: LocationPick[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cityResults, setCityResults] = useState<CityResult[]>([]);

  // Debounced city lookup against the race data.
  useEffect(() => {
    if (!query.trim()) {
      setCityResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/races/cities?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data: { cities: CityResult[] } = await res.json();
          setCityResults(data.cities);
        }
      } catch {
        // Typeahead only — ignore lookup failures.
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const isSelected = (kind: LocationPick["kind"], value: string) =>
    selected.some((s) => s.kind === kind && s.value === value);

  const toggle = (pick: LocationPick) =>
    onChange(
      isSelected(pick.kind, pick.value)
        ? selected.filter(
            (s) => !(s.kind === pick.kind && s.value === pick.value),
          )
        : [...selected, pick],
    );

  const item = (pick: LocationPick, key: string, cmdkValue: string) => (
    <CommandItem key={key} value={cmdkValue} onSelect={() => toggle(pick)}>
      <CheckIcon
        className={
          isSelected(pick.kind, pick.value) ? "opacity-100" : "opacity-0"
        }
      />
      {pick.label}
    </CommandItem>
  );

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
            aria-label="Locations"
          >
            <span className="truncate">
              {selected.length === 0
                ? "All locations"
                : selected.length === 1
                  ? selected[0].label
                  : `${selected.length} locations`}
            </span>
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search continent, country, or city…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No locations found.</CommandEmpty>
              <CommandGroup heading="Continents">
                {CONTINENT_OPTIONS.map(([code, name]) =>
                  item(
                    { kind: "continent", value: code, label: name },
                    `continent-${code}`,
                    name,
                  ),
                )}
              </CommandGroup>
              <CommandGroup heading="Countries">
                {ALL_COUNTRIES.map((c) =>
                  item(
                    { kind: "country", value: c.code, label: c.name },
                    `country-${c.code}`,
                    c.name,
                  ),
                )}
              </CommandGroup>
              {cityResults.length > 0 && (
                <CommandGroup heading="Cities">
                  {cityResults.map((c) =>
                    item(
                      {
                        kind: "city",
                        value: c.city,
                        label: `${c.city}, ${c.country}`,
                      },
                      `city-${c.city}-${c.countryCode}`,
                      `${c.city}, ${c.country}`,
                    ),
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((s) => (
            <Badge
              key={`${s.kind}-${s.value}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {s.label}
              <button
                type="button"
                aria-label={`Remove ${s.label}`}
                className="rounded-full hover:text-destructive"
                onClick={() => toggle(s)}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Checkbox-list dropdown; an empty selection means "no filter" (show all). */
function MultiSelect<T extends string>({
  options,
  selected,
  onChange,
  allLabel,
  noun,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  /** Trigger text when nothing is selected, e.g. "All entry types". */
  allLabel: string;
  /** Plural noun for the multi-selection summary, e.g. "entry types". */
  noun: string;
  ariaLabel: string;
}) {
  const triggerText =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} ${noun}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal"
          aria-label={ariaLabel}
        >
          <span className="truncate">{triggerText}</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-56 overflow-y-auto" align="start">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, o.value]
                  : selected.filter((x) => x !== o.value),
              )
            }
            // Keep the menu open while picking multiple options.
            onSelect={(e) => e.preventDefault()}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
      const byKind = (kind: LocationPick["kind"]) =>
        f.locations.filter((l) => l.kind === kind).map((l) => l.value);
      const [continents, countryCodes, cities] = [
        byKind("continent"),
        byKind("country"),
        byKind("city"),
      ];
      if (continents.length) params.set("continents", continents.join(","));
      if (countryCodes.length) params.set("countries", countryCodes.join(","));
      if (cities.length) params.set("cities", cities.join(","));
      if (f.entryStatuses.length)
        params.set("entryStatuses", f.entryStatuses.join(","));


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
    filters.locations,
    filters.entryStatuses,
    offset,
  ]);

  const updateFilters = (patch: Partial<FilterState>) => {
    setOffset(0);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

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

            <FilterGroup label="Filters">
              <div className="flex flex-col gap-3">
                <LocationSearch
                  selected={filters.locations}
                  onChange={(locations) => updateFilters({ locations })}
                />
                <MultiSelect
                  options={ENTRY_STATUSES.map((s) => ({
                    value: s,
                    label: ENTRY_STATUS_LABELS[s],
                  }))}
                  selected={filters.entryStatuses}
                  onChange={(entryStatuses) => updateFilters({ entryStatuses })}
                  allLabel="All entry types"
                  noun="entry types"
                  ariaLabel="Entry types"
                />


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
                  <TableHead>Tags</TableHead>
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
                      <TableCell>
                        {(race.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(race.tags ?? []).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="whitespace-nowrap text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
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
