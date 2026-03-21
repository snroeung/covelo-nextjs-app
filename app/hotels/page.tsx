'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { DateInput } from '@/components/DateInput';
import { GuestsDropdown, type GuestsValue } from '@/components/GuestsDropdown';
import { HotelCard } from '@/components/HotelCard';
import { HotelMap } from '@/components/HotelMap';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import { trpc } from '@/lib/trpc-client';
import { useTheme } from '@/contexts/ThemeContext';

const ROOM_OPTIONS = [1, 2, 3, 4, 5];

// Default child age when children are included (Duffel requires an age per child)
const DEFAULT_CHILD_AGE = 8;

function buildGuests(guests: GuestsValue) {
  const adults  = Array.from({ length: guests.adults },  () => ({ type: 'adult' as const }));
  const children = Array.from({ length: guests.children }, () => ({
    type: 'child' as const,
    age: DEFAULT_CHILD_AGE,
  }));
  return [...adults, ...children];
}

function EmptyState({ message }: { message: string }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${isDark ? 'border-cv-blue-900' : 'border-cv-blue-200'}`}>
      <p className={`text-sm ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-500'}`}>{message}</p>
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
  const [starsOpen, setStarsOpen]           = useState(false);
  const [sortOpen, setSortOpen]             = useState(false);
  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop]       = useState(false);

  useEffect(() => {
    const el = document.getElementById('app-main-scroll');
    if (!el) return;
    const onScroll = () => setShowBackToTop(el.scrollTop > 420);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  const starsRef                  = useRef<HTMLDivElement>(null);
  const sortRef                   = useRef<HTMLDivElement>(null);

  const { isDark } = useTheme();

  const hotelSearch = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (vars: any) => trpc.stays.search.mutate(vars),
  });

  const allAccommodations: any[] = hotelSearch.data ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const accommodations = [...allAccommodations] // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter((sr: any) => minStars === null || (sr.accommodation?.rating ?? 0) >= minStars) // eslint-disable-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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
    { label: 'Any', value: null },
    { label: '3+ stars', value: 3 },
    { label: '4+ stars', value: 4 },
    { label: '5 stars',  value: 5 },
  ];

  const starsLabel = STAR_OPTIONS.find(o => o.value === minStars)?.label ?? 'Any';

  const SORT_LABELS = { relevant: 'Most relevant', az: 'A to Z', lowest: 'Lowest price', highest: 'Highest price' } as const;

  const filterRowCls = `flex items-center gap-1.5 text-xs font-medium transition-colors ${isDark ? 'text-cv-blue-400 hover:text-cv-blue-200' : 'text-cv-blue-600 hover:text-cv-blue-700'}`;
  const dropdownCls  = `absolute right-0 top-full mt-1 z-50 rounded-xl border shadow-lg overflow-hidden ${isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-cv-blue-100'}`;
  const optionCls    = (active: boolean) => `w-full text-left px-4 py-2 text-sm transition-colors whitespace-nowrap ${active ? 'bg-cv-blue-600 text-white' : isDark ? 'text-cv-blue-100 hover:bg-cv-blue-800' : 'text-cv-blue-950 hover:bg-cv-blue-50'}`;
  const chevron      = (open: boolean) => (
    <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );

  const starsRow = (
    <div className="flex justify-end items-center gap-4 w-full pt-2 pb-1">
      {/* Stars */}
      <div className="relative" ref={starsRef}>
        <button
          onClick={() => setStarsOpen(o => !o)}
          onBlur={(e) => { if (!starsRef.current?.contains(e.relatedTarget as Node)) setStarsOpen(false); }}
          className={filterRowCls}
        >
          <span>Stars: {starsLabel}</span>
          {chevron(starsOpen)}
        </button>
        {starsOpen && (
          <div className={dropdownCls}>
            {STAR_OPTIONS.map((o) => (
              <button key={String(o.value)} onMouseDown={() => { setMinStars(o.value); setStarsOpen(false); }} className={optionCls(o.value === minStars)}>
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
          className={filterRowCls}
        >
          <span>Sort: {SORT_LABELS[sortOrder]}</span>
          {chevron(sortOpen)}
        </button>
        {sortOpen && (
          <div className={dropdownCls}>
            {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map((s) => (
              <button key={s} onMouseDown={() => { setSortOrder(s); setSortOpen(false); }} className={optionCls(s === sortOrder)}>
                {SORT_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const labelCls   = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const headingCls = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const subTextCls = isDark ? 'text-cv-blue-400' : 'text-cv-blue-500';
  const selectCls  = isDark
    ? 'border-cv-blue-900 bg-cv-blue-950 text-white'
    : 'border-cv-blue-100 bg-white text-cv-blue-950';

  const header = (
    <>
      {/* Row 1 (mobile) / leftmost (desktop): Location */}
      <div className="flex flex-col gap-0.5 w-full md:w-auto md:flex-1 md:min-w-0">
        <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>Location</span>
        <LocationSearch
          onSelect={setDestPlace}
          onClear={() => setDestPlace(null)}
        />
      </div>

      {/* Row 2 (mobile) / middle (desktop): Check-in + Check-out */}
      <div className="flex justify-between items-end gap-3 w-full md:w-auto md:justify-start">
        <DateInput label="Check-in"  value={checkIn}  onChange={setCheckIn} />
        <DateInput label="Check-out" value={checkOut} onChange={setCheckOut} />
      </div>

      {/* Row 3 (mobile) / rightmost (desktop): Rooms + Guests + Search */}
      <div className="flex justify-between items-end gap-3 w-full md:w-auto md:justify-start">
        <div className="flex flex-col gap-0.5">
          <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>
            Rooms
          </label>
          <select
            value={rooms}
            onChange={(e) => setRooms(Number(e.target.value))}
            className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cv-blue-600 ${selectCls}`}
          >
            {ROOM_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? 'room' : 'rooms'}</option>
            ))}
          </select>
        </div>

        <GuestsDropdown value={guests} onChange={setGuests} />

        {/* Search button */}
        <div className="flex flex-col justify-end ml-auto">
          <button
            onClick={handleSearch}
            disabled={!canSearch || hotelSearch.isPending}
            className="rounded-lg bg-cv-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cv-blue-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cv-blue-600 focus:ring-offset-2 transition-colors whitespace-nowrap"
          >
            {hotelSearch.isPending ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Stars filter row */}
      <div className="w-full">
        {starsRow}
      </div>
    </>
  );

  return (
    <AppShell header={header} hasResults={accommodations.length > 0}>
      {showBackToTop && (
        <button
          onClick={() => document.getElementById('app-main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`hidden md:flex fixed bottom-6 right-6 z-50 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-lg transition-colors ${isDark ? 'bg-cv-blue-800 text-cv-blue-100 hover:bg-cv-blue-700 border-cv-blue-700' : 'bg-white text-cv-blue-950 hover:bg-cv-blue-50 border-cv-blue-200'} border`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          Back to top
        </button>
      )}
      {hotelSearch.isPending ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-8 h-8 text-cv-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : hotelSearch.isError ? (
        <EmptyState message="Hotel search failed. Check your selections and try again." />
      ) : accommodations.length > 0 ? (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className={`text-xs font-semibold uppercase tracking-widest ${headingCls}`}>
              {accommodations.length} hotel{accommodations.length !== 1 ? 's' : ''} found
            </h2>
            <span className={`text-xs ${subTextCls}`}>
              {destPlace?.name} · {rooms} room{rooms !== 1 ? 's' : ''} · {guests.adults + guests.children} guest{guests.adults + guests.children !== 1 ? 's' : ''}
            </span>
          </div>
          <HotelMap
            accommodations={accommodations}
            center={{ lat: destPlace!.latitude, lng: destPlace!.longitude }}
            onLearnMore={(id) => setExpandedHotelId(id)}
          />
          {accommodations.map((sr, i) => (
            <div key={`${sr.id}-${sortOrder}`} id={`hotel-${sr.accommodation?.id}`}>
              <HotelCard
                searchResult={sr}
                defaultCollapsed={i >= 2}
                forceExpand={expandedHotelId === sr.accommodation?.id}
              />
            </div>
          ))}
        </>
      ) : hotelSearch.isSuccess ? (
        <EmptyState message="No hotels found for this location and dates." />
      ) : (
        <EmptyState message={!destPlace ? 'Search for a location to find hotels.' : 'Fill in dates and press Search.'} />
      )}
    </AppShell>
  );
}
