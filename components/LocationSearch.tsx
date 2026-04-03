'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { useDebounce } from '@/hooks/useDebounce';
import { useTheme } from '@/contexts/ThemeContext';
import type { PlaceLatLng } from '@/lib/places';

// Parses IATA codes from airport descriptions, e.g. "Heathrow Airport (LHR)" → "LHR"
function parseIata(description: string): string | undefined {
  const match = description.match(/\(([A-Z]{3})\)/);
  return match?.[1];
}

export interface SelectedPlace extends PlaceLatLng {
  description: string;
  iataCode?: string; // populated when forAirport=true and IATA is present in description
}

interface Props {
  onSelect: (place: SelectedPlace) => void;
  onClear: () => void;
  placeholder?: string;
  forAirport?: boolean; // restricts suggestions to airports and parses IATA from description
  initialValue?: string;    // pre-fill the text input without triggering autocomplete
  initialCommitted?: boolean; // if true, treat initialValue as already-selected (no auto-dropdown)
}

export function LocationSearch({ onSelect, onClear, placeholder, forAirport = false, initialValue, initialCommitted = false }: Props) {
  const { isDark } = useTheme();
  const listboxId = useId();

  const [input, setInput] = useState(initialValue ?? '');
  const [open, setOpen] = useState(false);
  // Session token groups all autocomplete calls — only the Place Details call is billed
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  // Tracks the last committed (selected) value. While input === committedInput the
  // dropdown stays closed even when new suggestion results arrive from the debounced query.
  // For airport mode with a pre-filled value that isn't already committed (e.g. city name
  // hint), leave committedInput empty so the dropdown opens on focus and the user can
  // pick the actual airport. When initialCommitted=true (auto-resolved airport), treat it
  // as already selected so the dropdown doesn't auto-open.
  const [committedInput, setCommittedInput] = useState(
    forAirport && initialValue && !initialCommitted ? '' : (initialValue ?? ''),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedInput = useDebounce(input, 300);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['places.autocomplete', debouncedInput, sessionToken, forAirport],
    queryFn: () => trpc.places.autocomplete.query({
      input: debouncedInput,
      sessionToken,
      types: forAirport ? 'airport' : undefined,
    }),
    enabled: debouncedInput.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // When forAirport=true, only show suggestions that include an IATA code — this
  // filters out private airstrips, military bases, and other non-public airports.
  const visibleSuggestions = forAirport
    ? suggestions.filter((s) => /\([A-Z]{3}\)/.test(s.description))
    : suggestions;

  useEffect(() => {
    // Don't reopen if the input still matches the committed (selected) value —
    // even after the debounced query fires and returns new suggestions.
    if (input === committedInput) return;
    setOpen(visibleSuggestions.length > 0 && input.trim().length >= 2);
  }, [visibleSuggestions, input, committedInput]);

  async function handleSelect(placeId: string, description: string) {
    setCommittedInput(description);
    setInput(description);
    setOpen(false);
    setResolving(true);
    setResolveError(null);
    try {
      // This is the only billed call — it ends the current session
      const result = await trpc.places.getLatLng.query({ placeId, sessionToken });
      const iataCode = forAirport ? parseIata(description) : undefined;
      onSelect({ ...result, description, iataCode });
      // Start a fresh session for the next search
      setSessionToken(crypto.randomUUID());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not resolve location';
      setResolveError(msg);
      // Still call onSelect with no lat/lng so the IATA input remains usable
      const iataCode = forAirport ? parseIata(description) : undefined;
      onSelect({ latitude: 0, longitude: 0, name: description, description, iataCode });
    } finally {
      setResolving(false);
    }
  }

  function handleChange(value: string) {
    setCommittedInput(''); // user is typing again — allow dropdown to reopen
    setInput(value);
    if (value.trim().length < 2) {
      setOpen(false);
      onClear();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setOpen(false);
    }
  }

  const defaultPlaceholder = forAirport ? 'City or airport' : 'City, neighborhood, or address';
  const inputCls = isDark
    ? 'border-cv-blue-900 bg-cv-blue-950 text-white placeholder:text-cv-blue-400/60'
    : 'border-cv-blue-100 bg-white text-cv-blue-950 placeholder:text-cv-blue-400';
  const dropdownBg = isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-cv-blue-100';
  const itemBase   = 'w-full text-left px-4 py-2.5 text-sm transition-colors';
  const itemHover  = isDark ? 'hover:bg-cv-blue-800 text-cv-blue-100' : 'hover:bg-cv-blue-50 text-cv-blue-950';

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        {resolving ? (
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cv-blue-400 animate-spin"
            fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : forAirport ? (
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-cv-blue-400 w-4 h-4"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 19l-7-7 1.5-1.5L11 15V3h2v12l4.5-4.5L19 12l-7 7z" />
          </svg>
        ) : (
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-cv-blue-400 w-4 h-4"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        )}
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          placeholder={placeholder ?? defaultPlaceholder}
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && input.length >= 2 && setOpen(true)}
          className={`w-full rounded-lg border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cv-blue-600 ${inputCls}`}
        />
      </div>

      {resolveError && (
        <p className="mt-1 px-1 text-xs text-cv-amber-400">{resolveError} — enter IATA code manually.</p>
      )}

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden ${dropdownBg}`}
        >
          {visibleSuggestions.map((s) => {
            const iata = forAirport ? parseIata(s.description) : undefined;
            return (
              <li key={s.placeId} role="option" aria-selected={false}>
                <button
                  className={`${itemBase} ${itemHover} flex items-center justify-between gap-3`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(s.placeId, s.description)}
                >
                  <span>{s.description}</span>
                  {iata && (
                    <span className="shrink-0 text-xs font-mono font-semibold text-cv-blue-400">{iata}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
