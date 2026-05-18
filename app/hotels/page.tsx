'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { DateInput } from '@/components/DateInput';
import { GuestsDropdown, type GuestsValue } from '@/components/GuestsDropdown';
import { HotelCard } from '@/components/HotelCard';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import { trpc } from '@/lib/trpc-client';
import { useTheme } from '@/contexts/ThemeContext';

const ROOM_OPTIONS = [1, 2, 3, 4, 5];
const DEFAULT_CHILD_AGE = 8;

function buildGuests(guests: GuestsValue) {
  const adults   = Array.from({ length: guests.adults },   () => ({ type: 'adult' as const }));
  const children = Array.from({ length: guests.children }, () => ({ type: 'child' as const, age: DEFAULT_CHILD_AGE }));
  return [...adults, ...children];
}

function EmptyState({ message }: { message: string }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${isDark ? 'border-cv-blue-900' : 'border-gray-200'}`}>
      <p className={`text-sm ${isDark ? 'text-cv-blue-400' : 'text-gray-400'}`}>{message}</p>
    </div>
  );
}

export default function HotelsPage() {
  const [destPlace, setDestPlace] = useState<SelectedPlace | null>(null);
  const [rooms, setRooms]         = useState(1);
  const [guests, setGuests]       = useState<GuestsValue>({ adults: 2, children: 0 });
  const [checkIn, setCheckIn]     = useState('');
  const [checkOut, setCheckOut]   = useState('');
  const [minStars, setMinStars]   = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'relevant' | 'az' | 'lowest' | 'highest'>('relevant');
  const [starsOpen, setStarsOpen] = useState(false);
  const [sortOpen, setSortOpen]   = useState(false);
  const starsRef = useRef<HTMLDivElement>(null);
  const sortRef  = useRef<HTMLDivElement>(null);

  const { isDark } = useTheme();

  const hotelSearch = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (vars: any) => trpc.stays.search.mutate(vars),
  });

  const allAccommodations: any[] = hotelSearch.data ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const accommodations = [...allAccommodations]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((sr: any) => minStars === null || (sr.accommodation?.rating ?? 0) >= minStars)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => {
      if (sortOrder === 'az')      return (a.accommodation?.name ?? '').localeCompare(b.accommodation?.name ?? '');
      if (sortOrder === 'lowest')  return parseFloat(a.cheapest_rate_total_amount) - parseFloat(b.cheapest_rate_total_amount);
      if (sortOrder === 'highest') return parseFloat(b.cheapest_rate_total_amount) - parseFloat(a.cheapest_rate_total_amount);
      return 0;
    });

  const canSearch = !!destPlace && !!checkIn && !!checkOut;

  function handleSearch() {
    if (!canSearch || !destPlace) return;
    hotelSearch.mutate({
      latitude: destPlace.latitude,
      longitude: destPlace.longitude,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      rooms,
      guests: buildGuests(guests),
    });
  }

  const STAR_OPTIONS: { label: string; value: number | null }[] = [
    { label: 'Any stars', value: null },
    { label: '3+ stars',  value: 3 },
    { label: '4+ stars',  value: 4 },
    { label: '5 stars',   value: 5 },
  ];

  const SORT_LABELS = {
    relevant: 'Best value',
    az:       'A to Z',
    lowest:   'Lowest price',
    highest:  'Highest price',
  } as const;

  const activeFilters = minStars !== null ? 1 : 0;

  const { isDark: dark } = useTheme();
  const ghostBtn = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
    dark
      ? 'border-cv-blue-800 text-cv-blue-300 hover:border-cv-blue-600 hover:text-white'
      : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
  }`;
  const dropdownCls = `absolute right-0 top-full mt-1 z-50 rounded-xl border shadow-lg overflow-hidden min-w-[140px] ${
    dark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-gray-200'
  }`;
  const optionCls = (active: boolean) =>
    `w-full text-left px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
      active
        ? 'bg-gray-900 text-white'
        : dark ? 'text-cv-blue-100 hover:bg-cv-blue-800' : 'text-gray-700 hover:bg-gray-50'
    }`;
  const chevron = (open: boolean) => (
    <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );

  const fieldBoxCls = isDark
    ? 'border-cv-blue-900 bg-cv-blue-950'
    : 'border-gray-200 bg-white';
  const fieldLabelCls = isDark ? 'text-cv-blue-400' : 'text-gray-400';
  const fieldValueCls = isDark ? 'text-white' : 'text-gray-900';

  const header = (
    <div className="w-full flex flex-col gap-2.5 md:grid md:items-stretch"
      style={{ gridTemplateColumns: '1fr 140px 140px 90px 140px auto' }}>

      {/* Location */}
      <LocationSearch
        fieldLabel="Location"
        onSelect={setDestPlace}
        onClear={() => setDestPlace(null)}
      />

      {/* Check-in */}
      <DateInput label="Check-in" value={checkIn} onChange={setCheckIn} />

      {/* Check-out */}
      <DateInput label="Check-out" value={checkOut} onChange={setCheckOut} />

      {/* Rooms */}
      <div className={`flex flex-col rounded-lg border px-3 py-2 focus-within:ring-2 focus-within:border-gray-900 focus-within:ring-gray-900/20 transition-colors ${fieldBoxCls}`}>
        <span className={`text-[9.5px] font-bold font-mono uppercase tracking-widest leading-none ${fieldLabelCls}`}>
          Rooms
        </span>
        <select
          value={rooms}
          onChange={(e) => setRooms(Number(e.target.value))}
          className={`text-sm font-semibold mt-1.5 bg-transparent outline-none cursor-pointer ${fieldValueCls}`}
        >
          {ROOM_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} {n === 1 ? 'room' : 'rooms'}</option>
          ))}
        </select>
      </div>

      {/* Guests */}
      <GuestsDropdown value={guests} onChange={setGuests} />

      {/* Search */}
      <button
        onClick={handleSearch}
        disabled={!canSearch || hotelSearch.isPending}
        className={`rounded-lg px-6 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isDark
            ? 'bg-cv-blue-600 hover:bg-cv-blue-400 focus:ring-cv-blue-600'
            : 'bg-gray-900 hover:bg-gray-700 focus:ring-gray-900'
        }`}
      >
        {hotelSearch.isPending ? 'Searching…' : 'Search →'}
      </button>
    </div>
  );

  const resultsHeader = accommodations.length > 0 && (
    <div className={`flex items-end justify-between pb-3 mb-5 border-b-2 ${isDark ? 'border-cv-blue-300' : 'border-gray-900'}`}>
      <div>
        <h2 className={`text-3xl font-extrabold tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {accommodations.length} hotel{accommodations.length !== 1 ? 's' : ''}{destPlace?.name ? ` in ${destPlace.name}` : ' found'}
        </h2>
        <p className={`text-[10px] font-bold font-mono tracking-widest uppercase mt-2 ${isDark ? 'text-cv-blue-400' : 'text-gray-500'}`}>
          {[
            destPlace?.name,
            rooms > 0 ? `${rooms} room${rooms !== 1 ? 's' : ''}` : null,
            guests.adults + guests.children > 0 ? `${guests.adults + guests.children} guest${guests.adults + guests.children !== 1 ? 's' : ''}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="flex gap-2 shrink-0">
        {/* Stars filter */}
        <div className="relative" ref={starsRef}>
          <button
            onClick={() => setStarsOpen(o => !o)}
            onBlur={(e) => { if (!starsRef.current?.contains(e.relatedTarget as Node)) setStarsOpen(false); }}
            className={ghostBtn}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            Filter{activeFilters > 0 ? ` · ${activeFilters}` : ''}
            {chevron(starsOpen)}
          </button>
          {starsOpen && (
            <div className={dropdownCls}>
              {STAR_OPTIONS.map((o) => (
                <button
                  key={String(o.value)}
                  onMouseDown={() => { setMinStars(o.value); setStarsOpen(false); }}
                  className={optionCls(o.value === minStars)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(o => !o)}
            onBlur={(e) => { if (!sortRef.current?.contains(e.relatedTarget as Node)) setSortOpen(false); }}
            className={ghostBtn}
          >
            Sort: {SORT_LABELS[sortOrder]}
            {chevron(sortOpen)}
          </button>
          {sortOpen && (
            <div className={dropdownCls}>
              {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map((s) => (
                <button
                  key={s}
                  onMouseDown={() => { setSortOrder(s); setSortOpen(false); }}
                  className={optionCls(s === sortOrder)}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell header={header} hasResults={accommodations.length > 0}>
      {hotelSearch.isPending ? (
        <div className="flex items-center justify-center py-24">
          <svg className={`w-8 h-8 animate-spin ${isDark ? 'text-cv-blue-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : hotelSearch.isError ? (
        <EmptyState message="Hotel search failed. Check your selections and try again." />
      ) : accommodations.length > 0 ? (
        <div className="space-y-4">
          {resultsHeader}
          {accommodations.map((sr) => (
            <HotelCard key={sr.id} searchResult={sr} />
          ))}
        </div>
      ) : hotelSearch.isSuccess ? (
        <EmptyState message="No hotels found for this location and dates." />
      ) : (
        <EmptyState message={!destPlace ? 'Search for a location to find hotels.' : 'Fill in dates and press Search.'} />
      )}
    </AppShell>
  );
}
