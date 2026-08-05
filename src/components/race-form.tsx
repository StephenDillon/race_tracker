"use client";

import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

interface CustomDistanceInput {
  label: string;
  kilometers: string;
}

interface EntryMethodInput {
  method: string;
  opens: string;
  closes: string;
}

/** The JSON payload the form produces — same shape POST and PATCH accept. */
export interface RaceFormPayload {
  name: string;
  date: string;
  city: string;
  region: string;
  countryCode: string;
  entryStatus: EntryStatus;
  website: string;
  description: string;
  distances: RaceDistance[];
  tags: string[];
  entryMethods: EntryMethodInput[];
}

/**
 * Create/edit race form. Pass `initial` to prefill for editing; `onSubmit`
 * does the API call and throws (with a message) on failure.
 */
export function RaceForm({
  initial,
  submitLabel,
  submittingLabel,
  onSubmit,
}: {
  initial?: Race;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (payload: RaceFormPayload) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [continent, setContinent] = useState<"" | ContinentCode>(
    initial ? (countries[initial.countryCode as TCountryCode]?.continent as ContinentCode) ?? "" : "",
  );
  const [countryCode, setCountryCode] = useState(initial?.countryCode ?? "");
  const [entryStatus, setEntryStatus] = useState<EntryStatus>(
    initial?.entryStatus ?? "open",
  );
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [standardDistances, setStandardDistances] = useState<StandardDistance[]>(
    initial?.distances
      .filter((d) => d.kind === "standard")
      .map((d) => d.distance) ?? [],
  );
  const [customDistances, setCustomDistances] = useState<CustomDistanceInput[]>(
    initial?.distances
      .filter((d) => d.kind === "custom")
      .map((d) => ({ label: d.label, kilometers: String(d.kilometers) })) ?? [],
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [entryMethods, setEntryMethods] = useState<EntryMethodInput[]>(
    initial?.entryMethods ?? [],
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const distances: RaceDistance[] = [
      ...standardDistances.map(
        (d): RaceDistance => ({ kind: "standard", distance: d }),
      ),
      ...customDistances
        .filter((c) => c.label.trim() && Number(c.kilometers) > 0)
        .map(
          (c): RaceDistance => ({
            kind: "custom",
            label: c.label.trim(),
            kilometers: Number(c.kilometers),
          }),
        ),
    ];

    if (distances.length === 0) {
      setError("Select at least one distance (standard or custom).");
      return;
    }

    if (!countryCode) {
      setError("Select a country.");
      return;
    }

    const incompleteMethod = entryMethods.find(
      (m) => !(m.method.trim() && m.opens && m.closes),
    );
    if (incompleteMethod) {
      setError("Each entry method needs a name plus opens and closes dates.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name,
        date,
        city,
        region,
        countryCode,
        entryStatus,
        website,
        description,
        distances,
        tags,
        entryMethods: entryMethods.map((m) => ({
          method: m.method.trim(),
          opens: m.opens,
          closes: m.closes,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const updateMethod = (i: number, patch: Partial<EntryMethodInput>) =>
    setEntryMethods((prev) =>
      prev.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="race-name">Race name *</Label>
        <Input
          id="race-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riverside Autumn Half"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="race-date">Race date *</Label>
        <Input
          id="race-date"
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Distances *</legend>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          spacing={1}
          className="mb-3 flex-wrap"
          value={standardDistances}
          onValueChange={(v) => setStandardDistances(v as StandardDistance[])}
        >
          {STANDARD_DISTANCES.map((d) => (
            <ToggleGroupItem key={d} value={d}>
              {d}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {customDistances.map((c, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <Input
              value={c.label}
              onChange={(e) =>
                setCustomDistances((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                )
              }
              placeholder="Custom distance name (e.g. 7.7K trail loop)"
            />
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={c.kilometers}
              onChange={(e) =>
                setCustomDistances((prev) =>
                  prev.map((x, j) =>
                    j === i ? { ...x, kilometers: e.target.value } : x,
                  ),
                )
              }
              placeholder="km"
              className="w-24"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setCustomDistances((prev) => prev.filter((_, j) => j !== i))
              }
              aria-label="Remove custom distance"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          onClick={() =>
            setCustomDistances((prev) => [...prev, { label: "", kilometers: "" }])
          }
        >
          + Add custom distance
        </Button>
      </fieldset>

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
          <Label htmlFor="race-city">City *</Label>
          <Input
            id="race-city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="race-region">Region / State *</Label>
          <Input
            id="race-region"
            required
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Entry status *</Label>
        <Select
          value={entryStatus}
          onValueChange={(v) => setEntryStatus(v as EntryStatus)}
        >
          <SelectTrigger className="w-full" aria-label="Entry status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTRY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ENTRY_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tags</legend>
        <div className="flex flex-col gap-3">
          {["World Major", "World Major Qualifier"].map((tag) => (
            <div key={tag} className="flex items-center gap-2">
              <Checkbox
                id={`tag-${tag}`}
                checked={tags.includes(tag)}
                onCheckedChange={(checked) =>
                  setTags((prev) =>
                    checked ? [...prev, tag] : prev.filter((t) => t !== tag),
                  )
                }
              />
              <Label htmlFor={`tag-${tag}`} className="font-normal">
                {tag}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Entry methods</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          How runners get in (lottery, qualifier, charity, …) and when each
          window opens and closes. Shown on the World Majors page.
        </p>
        {entryMethods.map((m, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <Input
              value={m.method}
              onChange={(e) => updateMethod(i, { method: e.target.value })}
              placeholder="e.g. Lottery"
              aria-label={`Entry method ${i + 1} name`}
            />
            <Input
              type="date"
              value={m.opens}
              onChange={(e) => updateMethod(i, { opens: e.target.value })}
              className="w-36 shrink-0"
              aria-label={`Entry method ${i + 1} opens`}
            />
            <Input
              type="date"
              value={m.closes}
              onChange={(e) => updateMethod(i, { closes: e.target.value })}
              className="w-36 shrink-0"
              aria-label={`Entry method ${i + 1} closes`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setEntryMethods((prev) => prev.filter((_, j) => j !== i))
              }
              aria-label="Remove entry method"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          onClick={() =>
            setEntryMethods((prev) => [
              ...prev,
              { method: "", opens: "", closes: "" },
            ])
          }
        >
          + Add entry method
        </Button>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="race-website">Website</Label>
        <Input
          id="race-website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="race-description">Description</Label>
        <Textarea
          id="race-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Course profile, atmosphere, anything runners should know."
        />
      </div>

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
