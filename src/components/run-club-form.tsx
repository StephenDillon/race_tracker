"use client";

import { useMemo, useState } from "react";
import { continents, countries, type TCountryCode } from "countries-list";
import {
  MONTHLY_WEEKS,
  WEEKDAYS,
  type ClubRun,
  type ContinentCode,
  type MonthlyWeek,
  type RunClub,
} from "@/lib/types";
import {
  AddressAutocomplete,
  type ResolvedAddress,
} from "@/components/address-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// Radix Select items cannot have an empty-string value.
const ANY = "any";

const MONTHLY_WEEK_LABELS: Record<MonthlyWeek, string> = {
  "1": "1st",
  "2": "2nd",
  "3": "3rd",
  "4": "4th",
  last: "Last",
};

/** Flat editing state for one run row; converted to a ClubRun on submit. */
interface RunInput {
  kind: ClubRun["kind"];
  title: string;
  day: string; // "0"–"6"
  week: MonthlyWeek;
  time: string; // HH:MM
  date: string; // YYYY-MM-DD (events)
  location: string;
}

const EMPTY_RUN: RunInput = {
  kind: "weekly",
  title: "",
  day: "6",
  week: "1",
  time: "",
  date: "",
  location: "",
};

function runToInput(run: ClubRun): RunInput {
  return {
    ...EMPTY_RUN,
    kind: run.kind,
    title: run.title,
    location: run.location ?? "",
    ...(run.kind === "weekly" && { day: String(run.day), time: run.time }),
    ...(run.kind === "monthly" && {
      day: String(run.day),
      week: run.week,
      time: run.time,
    }),
    ...(run.kind === "event" && { date: run.date, time: run.time ?? "" }),
  };
}

function inputToRun(input: RunInput): ClubRun {
  const shared = {
    title: input.title.trim(),
    location: input.location.trim() || undefined,
  };
  switch (input.kind) {
    case "weekly":
      return { kind: "weekly", ...shared, day: Number(input.day), time: input.time };
    case "monthly":
      return {
        kind: "monthly",
        ...shared,
        week: input.week,
        day: Number(input.day),
        time: input.time,
      };
    case "event":
      return {
        kind: "event",
        ...shared,
        date: input.date,
        time: input.time || undefined,
      };
  }
}

/** The JSON payload the form produces — same shape POST and PATCH accept. */
export interface RunClubFormPayload {
  name: string;
  city: string;
  countryCode: string;
  address: string;
  region: string;
  website: string;
  runs: ClubRun[];
  /**
   * Set when the address came from address search. The server re-resolves it
   * to derive the country and coordinates, so those aren't sent from here.
   */
  placeId?: string;
}

/**
 * Create/edit run club form. Pass `initial` to prefill for editing;
 * `onSubmit` does the API call and throws (with a message) on failure.
 */
export function RunClubForm({
  initial,
  submitLabel,
  submittingLabel,
  onSubmit,
}: {
  initial?: RunClub;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (payload: RunClubFormPayload) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [continent, setContinent] = useState<"" | ContinentCode>(
    initial
      ? ((countries[initial.countryCode as TCountryCode]?.continent as ContinentCode) ?? "")
      : "",
  );
  const [countryCode, setCountryCode] = useState(initial?.countryCode ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [placeId, setPlaceId] = useState(initial?.placeId ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [runs, setRuns] = useState<RunInput[]>(
    initial?.runs.map(runToInput) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countryOptions = useMemo(
    () =>
      continent
        ? ALL_COUNTRIES.filter((c) => c.continent === continent)
        : ALL_COUNTRIES,
    [continent],
  );

  // A picked address prefills the location fields (and the continent, so the
  // country stays visible in its filtered dropdown). All stay editable —
  // Google's city component is unreliable enough to want a manual override.
  const handleAddressSelect = (place: ResolvedAddress) => {
    setAddress(place.label);
    setPlaceId(place.placeId);
    if (place.city) setCity(place.city);
    setRegion(place.region);
    setCountryCode(place.countryCode);
    setContinent(
      (countries[place.countryCode as TCountryCode]?.continent as ContinentCode) ?? "",
    );
  };

  // Drops the Google link but keeps whatever is already in the fields.
  const handleAddressClear = () => {
    setAddress("");
    setPlaceId("");
  };

  const updateRun = (i: number, patch: Partial<RunInput>) =>
    setRuns((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!countryCode) {
      setError("Select a country.");
      return;
    }

    for (const run of runs) {
      if (!run.title.trim()) {
        setError("Each run needs a name (e.g. \"Saturday Long Run\").");
        return;
      }
      if (run.kind === "event" && !run.date) {
        setError(`"${run.title.trim()}" is a one-off event and needs a date.`);
        return;
      }
      if (run.kind !== "event" && !run.time) {
        setError(`"${run.title.trim()}" needs a start time.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name,
        city,
        countryCode,
        address,
        region,
        website,
        runs: runs.map(inputToRun),
        placeId: placeId || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const daySelect = (i: number, run: RunInput) => (
    <Select value={run.day} onValueChange={(v) => updateRun(i, { day: v })}>
      <SelectTrigger className="w-32" aria-label={`Run ${i + 1} day`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WEEKDAYS.map((d, idx) => (
          <SelectItem key={d} value={String(idx)}>
            {d}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="club-name">Club name *</Label>
        <Input
          id="club-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riverside Road Runners"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Meetup address</Label>
        <AddressAutocomplete
          value={address}
          onSelect={handleAddressSelect}
          onClear={handleAddressClear}
        />
        <p className="text-xs text-muted-foreground">
          Search for where the club meets — city, region, and country fill in
          below. Adjust any of them if the match isn&apos;t quite right, or skip
          the search and fill them in yourself.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Continent</Label>
          <Select
            value={continent || ANY}
            onValueChange={(v) => {
              setContinent(v === ANY ? "" : (v as ContinentCode));
              setCountryCode("");
            }}
          >
            <SelectTrigger className="w-full" aria-label="Continent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All continents</SelectItem>
              {CONTINENT_OPTIONS.map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Country *</Label>
          <Select value={countryCode || undefined} onValueChange={setCountryCode}>
            <SelectTrigger className="w-full" aria-label="Country">
              <SelectValue placeholder="Select a country…" />
            </SelectTrigger>
            <SelectContent>
              {countryOptions.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="club-city">City *</Label>
          <Input
            id="club-city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="club-region">Region / State</Label>
          <Input
            id="club-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="club-website">Website</Label>
        <Input
          id="club-website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Runs</legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Weekly runs, monthly runs, or one-off events. All optional — add them
          any time.
        </p>
        <div className="flex flex-col gap-3">
          {runs.map((run, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Select
                  value={run.kind}
                  onValueChange={(v) => updateRun(i, { kind: v as ClubRun["kind"] })}
                >
                  <SelectTrigger className="w-36 shrink-0" aria-label={`Run ${i + 1} type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly run</SelectItem>
                    <SelectItem value="monthly">Monthly run</SelectItem>
                    <SelectItem value="event">One-off event</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={run.title}
                  onChange={(e) => updateRun(i, { title: e.target.value })}
                  placeholder='e.g. "Saturday Long Run"'
                  aria-label={`Run ${i + 1} name`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRuns((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove run ${i + 1}`}
                >
                  ✕
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {run.kind === "monthly" && (
                  <Select
                    value={run.week}
                    onValueChange={(v) => updateRun(i, { week: v as MonthlyWeek })}
                  >
                    <SelectTrigger className="w-24" aria-label={`Run ${i + 1} week of month`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHLY_WEEKS.map((w) => (
                        <SelectItem key={w} value={w}>
                          {MONTHLY_WEEK_LABELS[w]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {run.kind !== "event" && daySelect(i, run)}
                {run.kind === "event" && (
                  <Input
                    type="date"
                    value={run.date}
                    onChange={(e) => updateRun(i, { date: e.target.value })}
                    className="w-36"
                    aria-label={`Run ${i + 1} date`}
                  />
                )}
                <Input
                  type="time"
                  value={run.time}
                  onChange={(e) => updateRun(i, { time: e.target.value })}
                  className="w-28"
                  aria-label={`Run ${i + 1} time`}
                />
                <Input
                  value={run.location}
                  onChange={(e) => updateRun(i, { location: e.target.value })}
                  placeholder="Meeting point (optional)"
                  className="min-w-40 flex-1"
                  aria-label={`Run ${i + 1} meeting point`}
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          onClick={() => setRuns((prev) => [...prev, { ...EMPTY_RUN }])}
        >
          + Add run
        </Button>
      </fieldset>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}
