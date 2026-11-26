'use client';

import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { useDebounce } from '@/hooks/useDebounce';
import { useTheme } from '@/contexts/ThemeContext';
import { pickBestSuggestion } from '@/lib/bestSuggestion';
import type { PlaceLatLng } from '@/lib/places';

const SUGGESTION_STALE_MS = 1000 * 60 * 10;
const hasIata = (description: string) => /\([A-Z]{3}\)/.test(description);

// Parses IATA codes from airport descriptions, e.g. "Heathrow Airport (LHR)" → "LHR"
function parseIata(description: string): string | undefined {
  const match = description.match(/\(([A-Z]{3})\)/);
  return match?.[1];
}

export interface SelectedPlace extends PlaceLatLng {
  description: string;
  iataCode?: string; // populated when forAirport=true and IATA is present in description
}

export type BestMatchResult =
  | { status: 'picked'; place: SelectedPlace }   // a suggestion was auto-selected
  | { status: 'no-suggestions' }                 // autocomplete answered with nothing
  | { status: 'unavailable' };                   // autocomplete (or Place Details) is down

export interface LocationSearchHandle {
  /**
   * Submit-time selection when the user typed but didn't pick: select the suggestion that
   * exactly matches the text, else the closest (top-ranked) one, and commit it via onSelect.
   */
  commitBestMatch(): Promise<BestMatchResult>;
}

interface Props {
  ref?: Ref<LocationSearchHandle>;
  onSelect: (place: SelectedPlace) => void;
  onClear: () => void;
  placeholder?: string;
  forAirport?: boolean;    // restricts suggestions to airports and parses IATA from description
  fieldLabel?: string;     // when set, renders label inside the bordered field box
  initialValue?: string;   // pre-filled input text (e.g. from saved trip planner state)
  initialCommitted?: boolean; // treat initialValue as already-selected (no auto-open dropdown)
  onTextChange?: (text: string) => void; // raw typed text, so the page can resolve it on submit
}

export function LocationSearch({ ref, onSelect, onClear, placeholder, forAirport = false, fieldLabel, initialValue, initialCommitted, onTextChange }: Props) {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const listboxId = useId();

  const [input, setInput] = useState(initialValue ?? '');
  const [open, setOpen] = useState(false);
  // Session token groups all autocomplete calls — only the Place Details call is billed
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());
  const [resolving, setResolving] = useState(false);
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

  // One key + fetcher for both the as-you-type dropdown and the submit-time best match, so
  // they share the cache (a submit right after typing reuses the dropdown's results).
  const suggestionsKey = (text: string) => ['places.autocomplete', text, sessionToken, forAirport];
  const fetchSuggestions = (text: string) => trpc.places.autocomplete.query({
    input: text,
    sessionToken,
    types: forAirport ? 'airport' : undefined,
  });

  const { data } = useQuery({
    queryKey: suggestionsKey(debouncedInput),
    queryFn: () => fetchSuggestions(debouncedInput),
    enabled: debouncedInput.trim().length >= 2,
    staleTime: SUGGESTION_STALE_MS,
  });
  // Stable fallback so the render-time sync below doesn't see a new [] every render.
  const suggestions = useMemo(() => data ?? [], [data]);

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
    ? suggestions.filter((s) => hasIata(s.description))
    : suggestions;

  // Re-evaluate the dropdown when suggestions or input change (adjusting state during
  // render, not in an effect). Don't reopen if the input still matches the committed
  // (selected) value — even after the debounced query fires and returns new suggestions.
  const [openSync, setOpenSync] = useState({ suggestions, input, committedInput });
  if (openSync.suggestions !== suggestions || openSync.input !== input || openSync.committedInput !== committedInput) {
    setOpenSync({ suggestions, input, committedInput });
    if (input !== committedInput) setOpen(visibleSuggestions.length > 0 && input.trim().length >= 2);
  }

  async function handleSelect(placeId: string, description: string): Promise<SelectedPlace> {
    setCommittedInput(description);
    setInput(description);
    setOpen(false);
    setResolving(true);
    const iataCode = forAirport ? parseIata(description) : undefined;
    try {
      // This is the only billed call — it ends the current session
      const result = await trpc.places.getLatLng.query({ placeId, sessionToken });
      const place = { ...result, description, iataCode };
      onSelect(place);
      // Start a fresh session for the next search
      setSessionToken(crypto.randomUUID());
      return place;
    } catch {
      // Details lookup failed — commit with no lat/lng so an IATA pick still works downstream.
      const place = { latitude: 0, longitude: 0, name: description, description, iataCode };
      onSelect(place);
      return place;
    } finally {
      setResolving(false);
    }
  }

  async function commitBestMatch(): Promise<BestMatchResult> {
    const text = input.trim();
    if (text.length < 2) return { status: 'no-suggestions' };

    let list: { placeId: string; description: string }[];
    try {
      // Suggestions for exactly what's typed — not the debounced value, which can lag a
      // fast submit. Served from cache when the dropdown already fetched this text.
      list = await queryClient.fetchQuery({
        queryKey: suggestionsKey(input),
        queryFn: () => fetchSuggestions(input),
        staleTime: SUGGESTION_STALE_MS,
        retry: false,
      });
    } catch {
      return { status: 'unavailable' };
    }

    const candidates = forAirport ? list.filter((s) => hasIata(s.description)) : list;
    const best = pickBestSuggestion(text, candidates, forAirport);
    if (!best) return { status: 'no-suggestions' };

    const place = await handleSelect(best.placeId, best.description);
    // A place search needs coordinates; a failed Place Details lookup leaves 0,0.
    if (!forAirport && place.latitude === 0 && place.longitude === 0) return { status: 'unavailable' };
    return { status: 'picked', place };
  }

  useImperativeHandle(ref, () => ({ commitBestMatch }));

  function handleChange(value: string) {
    setCommittedInput(''); // user is typing again — allow dropdown to reopen
    setInput(value);
    // Pages that resolve on submit use onTextChange to drop a now-stale picked place.
    // onClear keeps its original meaning (field emptied) — some consumers reset more than
    // the place on clear (e.g. the trip planner wipes dates/title), so it must not fire
    // on every keystroke.
    onTextChange?.(value);
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

  const boxCls   = isDark ? 'border-gph-dark-line bg-gph-dark-card' : 'border-gray-200 bg-white';
  const iconCls  = isDark ? 'text-gph-dark-muted' : 'text-gray-400';
  const inputCls = isDark
    ? 'border-gph-dark-line bg-gph-dark-card text-gph-dark-ink placeholder:text-gph-dark-muted/60'
    : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400';
  const dropdownBg = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const itemBase   = 'w-full text-left px-4 py-2.5 text-sm transition-colors';
  const itemHover  = isDark ? 'hover:bg-gph-dark-linesoft text-gph-dark-ink' : 'hover:bg-gray-50 text-gray-900';

  const icon = resolving ? (
    <svg className={`w-4 h-4 ${iconCls} animate-spin shrink-0`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  ) : forAirport ? (
    <svg className={`w-4 h-4 ${iconCls} shrink-0`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l-7-7 1.5-1.5L11 15V3h2v12l4.5-4.5L19 12l-7 7z" />
    </svg>
  ) : (
    <svg className={`w-4 h-4 ${iconCls} shrink-0`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {fieldLabel ? (
        /* Field-box mode: label inside the bordered container */
        <div className={`flex flex-col rounded-lg border px-3 py-2 focus-within:ring-2 focus-within:border-gray-900 focus-within:ring-gray-900/20 transition-colors ${boxCls}`}>
          <span className={`text-[9.5px] font-bold font-mono uppercase tracking-widest leading-none ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`}>
            {fieldLabel}
          </span>
          <div className="flex items-center gap-2 mt-1.5">
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
              className={`flex-1 min-w-0 text-sm font-semibold bg-transparent outline-none ${isDark ? 'text-gph-dark-ink placeholder:text-gph-dark-muted/60' : 'text-gray-900 placeholder:text-gray-400'}`}
            />
          </div>
        </div>
      ) : (
        /* Standard mode: standalone input with its own border */
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
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
            className={`w-full rounded-lg border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 ${inputCls}`}
          />
        </div>
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
                    <span className={`shrink-0 text-xs font-mono font-semibold ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>{iata}</span>
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
