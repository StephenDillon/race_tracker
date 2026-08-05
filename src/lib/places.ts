import "server-only";

import { countries, getCountryData, type TCountryCode } from "countries-list";

/**
 * Google Places API (New) wrapper. Server-side only: the key never reaches
 * the browser (see AGENTS.md restriction 1), so the UI calls /api/places
 * and this module is the only thing that talks to Google.
 *
 * Autocomplete and Place Details calls that share a session token bill as
 * one session, so callers must pass the same token through both steps.
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

export interface PlaceSuggestion {
  placeId: string;
  /** Main line, e.g. "10 Downing Street". */
  primaryText: string;
  /** Context line, e.g. "London, UK". */
  secondaryText: string;
}

/** A place resolved to the fields we store on a run club. */
export interface ResolvedPlace {
  placeId: string;
  formattedAddress: string;
  city: string;
  region: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

/** Whether a Places key is configured; routes 503 when it isn't. */
export function isPlacesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  return key;
}

interface GoogleAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

/**
 * Google's `locality` is missing or unhelpful in plenty of countries (UK
 * addresses carry `postal_town`, some regions only populate admin areas),
 * so fall back down a chain rather than trusting one component type.
 */
const CITY_COMPONENT_PRIORITY = [
  "locality",
  "postal_town",
  "administrative_area_level_3",
  "administrative_area_level_2",
  "sublocality_level_1",
  "sublocality",
];

function pickComponent(
  components: GoogleAddressComponent[],
  types: string[],
): GoogleAddressComponent | undefined {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match;
  }
  return undefined;
}

/** Suggestions for a partial address. Returns [] for blank input. */
export async function autocompleteAddress(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({ input: input.trim(), sessionToken }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Places autocomplete failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  };

  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      placeId: p.placeId,
      primaryText: p.structuredFormat?.mainText?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

/**
 * Resolve a place id to the address fields we store. Pass the same session
 * token used for the autocomplete requests so the session bills as one.
 * Returns null when the place has no usable country.
 */
export async function resolvePlace(
  placeId: string,
  sessionToken?: string,
): Promise<ResolvedPlace | null> {
  const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Place details failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    id: string;
    formattedAddress?: string;
    addressComponents?: GoogleAddressComponent[];
    location?: { latitude: number; longitude: number };
  };

  const components = data.addressComponents ?? [];
  const country = pickComponent(components, ["country"]);
  const countryCode = country?.shortText?.toUpperCase() ?? "";
  // Without a country we can't satisfy the club's not-null country columns.
  if (!(countryCode in countries)) return null;

  const city = pickComponent(components, CITY_COMPONENT_PRIORITY);
  const region = pickComponent(components, ["administrative_area_level_1"]);

  return {
    placeId: data.id,
    formattedAddress: data.formattedAddress ?? "",
    city: city?.longText ?? "",
    region: region?.longText ?? "",
    countryCode,
    latitude: data.location?.latitude ?? 0,
    longitude: data.location?.longitude ?? 0,
  };
}

/** Display name for a country code, e.g. "GB" → "United Kingdom". */
export function countryNameFor(countryCode: string): string {
  return getCountryData(countryCode as TCountryCode).name;
}
