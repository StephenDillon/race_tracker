"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ENTRY_STATUS_LABELS,
  ENTRY_STATUSES,
  STANDARD_DISTANCES,
  type EntryStatus,
  type RaceDistance,
  type StandardDistance,
} from "@/lib/types";

interface CustomDistanceInput {
  label: string;
  kilometers: string;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default function SubmitRacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [entryStatus, setEntryStatus] = useState<EntryStatus>("open");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [standardDistances, setStandardDistances] = useState<StandardDistance[]>([]);
  const [customDistances, setCustomDistances] = useState<CustomDistanceInput[]>([]);
  const [isMajorMarathon, setIsMajorMarathon] = useState(false);
  const [isMajorQualifier, setIsMajorQualifier] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStandard = (d: StandardDistance) =>
    setStandardDistances((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date,
          city,
          region,
          country,
          entryStatus,
          website,
          description,
          distances,
          isMajorMarathon,
          isMajorQualifier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit race");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold">Submit a race</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Anyone can submit a race. Pick standard distances or add a custom one.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Race name *</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riverside Autumn Half"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Race date *</span>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>

        <fieldset className="text-sm">
          <legend className="mb-2 font-medium">Distances *</legend>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {STANDARD_DISTANCES.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleStandard(d)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  standardDistances.includes(d)
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 hover:border-emerald-500 dark:border-zinc-700"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {customDistances.map((c, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input
                value={c.label}
                onChange={(e) =>
                  setCustomDistances((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                placeholder="Custom distance name (e.g. 7.7K trail loop)"
                className={inputClass}
              />
              <input
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
                className={`${inputClass} w-24`}
              />
              <button
                type="button"
                onClick={() =>
                  setCustomDistances((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-zinc-400 hover:text-rose-600"
                aria-label="Remove custom distance"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCustomDistances((prev) => [...prev, { label: "", kilometers: "" }])
            }
            className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
          >
            + Add custom distance
          </button>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">City *</span>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Region / State *</span>
            <input
              required
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Country *</span>
            <input
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Entry status *</span>
          <select
            value={entryStatus}
            onChange={(e) => setEntryStatus(e.target.value as EntryStatus)}
            className={inputClass}
          >
            {ENTRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ENTRY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isMajorMarathon}
              onChange={(e) => setIsMajorMarathon(e.target.checked)}
              className="accent-emerald-600"
            />
            World Marathon Major
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isMajorQualifier}
              onChange={(e) => setIsMajorQualifier(e.target.checked)}
              className="accent-emerald-600"
            />
            Major qualifier (results usable to qualify for a major)
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Website</span>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Course profile, atmosphere, anything runners should know."
            className={inputClass}
          />
        </label>

        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit race"}
        </button>
      </form>
    </div>
  );
}
