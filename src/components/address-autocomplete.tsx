"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { MapPinIcon } from "lucide-react";

interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

/** The resolved place the form applies to its fields. */
export interface ResolvedAddress {
  placeId: string;
  formattedAddress: string;
  city: string;
  region: string;
  countryCode: string;
  /**
   * Address text for the club's meetup field. Google drops the landmark name
   * from `formattedAddress` (Central Park resolves to "New York, NY, USA"),
   * so the suggestion's own name is prepended when it's been lost.
   */
  label: string;
}

/**
 * Address search backed by /api/places (Google Places, proxied server-side).
 *
 * A session token ties the keystroke lookups to the final details call so
 * Google bills them as one session; it's regenerated after each selection.
 */
export function AddressAutocomplete({
  value,
  onSelect,
  onClear,
}: {
  /** Current address text, shown on the trigger. */
  value: string;
  onSelect: (place: ResolvedAddress) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One session spans the typing that leads to a single selection.
  const sessionRef = useRef<string>("");
  if (!sessionRef.current && typeof crypto !== "undefined") {
    sessionRef.current = crypto.randomUUID();
  }

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setError(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/places?q=${encodeURIComponent(query.trim())}&session=${sessionRef.current}`,
        );
        if (res.status === 503) {
          setError("Address lookup isn't configured yet.");
          setSuggestions([]);
          return;
        }
        if (res.status === 401) {
          setError("Log in to search addresses.");
          setSuggestions([]);
          return;
        }
        if (!res.ok) throw new Error();
        const data: { suggestions: PlaceSuggestion[] } = await res.json();
        setSuggestions(data.suggestions);
        setError(null);
      } catch {
        setError("Address lookup failed.");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const handlePick = async (suggestion: PlaceSuggestion) => {
    try {
      const res = await fetch(
        `/api/places/${encodeURIComponent(suggestion.placeId)}?session=${sessionRef.current}`,
      );
      if (!res.ok) throw new Error();
      const data: { place: ResolvedAddress } = await res.json();
      const { primaryText } = suggestion;
      const formatted = data.place.formattedAddress;
      const label =
        primaryText && !formatted.includes(primaryText)
          ? `${primaryText}, ${formatted}`
          : formatted;
      onSelect({ ...data.place, label });
      setOpen(false);
      setQuery("");
      setSuggestions([]);
      // The session ended with this selection; the next search starts a new one.
      sessionRef.current = crypto.randomUUID();
    } catch {
      setError("Could not load that address.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start font-normal"
            aria-label="Search for an address"
          >
            <MapPinIcon className="text-muted-foreground" />
            <span className="truncate">
              {value || "Search for an address…"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Start typing an address…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {error ? (
                <div className="p-3 text-sm text-muted-foreground">{error}</div>
              ) : loading ? (
                <div className="p-3 text-sm text-muted-foreground">Searching…</div>
              ) : (
                <CommandEmpty>
                  {query.trim() ? "No matching addresses." : "Start typing an address."}
                </CommandEmpty>
              )}
              {suggestions.length > 0 && (
                <CommandGroup>
                  {suggestions.map((s) => (
                    <CommandItem
                      key={s.placeId}
                      value={s.placeId}
                      onSelect={() => handlePick(s)}
                    >
                      <div className="flex flex-col">
                        <span>{s.primaryText}</span>
                        {s.secondaryText && (
                          <span className="text-xs text-muted-foreground">
                            {s.secondaryText}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="self-start text-xs text-muted-foreground hover:text-destructive"
        >
          Clear address and enter manually
        </button>
      )}
    </div>
  );
}
