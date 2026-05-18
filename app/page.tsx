'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { DateInput } from '@/components/DateInput';
import { FlightCard } from '@/components/FlightCard';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';

type TripType = 'roundtrip' | 'oneway';
type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
type SortOrder = 'relevant' | 'az' | 'lowest' | 'highest';

const SORT_LABELS: Record<SortOrder, string> = {
  relevant: 'Most relevant',
  az:       'A to Z',
  lowest:   'Lowest price',
  highest:  'Highest price',
};

const CABIN_LABELS: Record<CabinClass, string> = {
  economy:         'Economy',
  premium_economy: 'Premium Economy',
  business:        'Business',
  first:           'First',
};

function EmptyState({ message }: { message: string }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${isDark ? 'border-cv-blue-900' : 'border-gray-200'}`}>
      <p className={`text-sm ${isDark ? 'text-cv-blue-400' : 'text-gray-400'}`}>{message}</p>
    </div>
  );
}

export default function FlightsPage() {
  const [tripType, setTripType]         = useState<TripType>('roundtrip');
  const [cabinClass, setCabinClass]     = useState<CabinClass>('economy');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('relevant');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [originPlace, setOriginPlace]   = useState<SelectedPlace | null>(null);
  const [arrivalPlace, setArrivalPlace] = useState<SelectedPlace | null>(null);

  const { isDark } = useTheme();

  const flightSearch = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (vars: any) => trpc.flights.searchOffers.mutate(vars),
  });

  const rawOffers: any[] = flightSearch.data?.offers ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const offers = [...rawOffers].sort((a: any, b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (sortOrder === 'az')      return (a.owner?.name ?? '').localeCompare(b.owner?.name ?? '');
    if (sortOrder === 'lowest')  return parseFloat(a.total_amount) - parseFloat(b.total_amount);
    if (sortOrder === 'highest') return parseFloat(b.total_amount) - parseFloat(a.total_amount);
    return 0;
  });

  const originCode  = originPlace?.iataCode ?? '';
  const arrivalCode = arrivalPlace?.iataCode ?? '';
  const canSearch   = originCode.length === 3 && arrivalCode.length === 3 && !!startDate
    && (tripType === 'oneway' || !!endDate);

  function handleSearch() {
    if (!canSearch) return;
    flightSearch.mutate({
      origin: originCode,
      destination: arrivalCode,
      departureDate: startDate,
      returnDate: tripType === 'roundtrip' && endDate ? endDate : undefined,
      passengers: 1,
      cabinClass,
    });
  }

  const cabinRef = useRef<HTMLDivElement>(null);
  const sortRef  = useRef<HTMLDivElement>(null);
  const [cabinOpen, setCabinOpen] = useState(false);
  const [sortOpen, setSortOpen]   = useState(false);

  // Shared field-box styles (same as hotels page)
  const fieldBoxCls   = isDark ? 'border-cv-blue-900 bg-cv-blue-950' : 'border-gray-200 bg-white';
  const fieldLabelCls = isDark ? 'text-cv-blue-400' : 'text-gray-400';
  const fieldValueCls = isDark ? 'text-white' : 'text-gray-900';

  const ghostBtn = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
    isDark
      ? 'border-cv-blue-800 text-cv-blue-300 hover:border-cv-blue-600 hover:text-white'
      : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
  }`;
  const dropdownCls = `absolute right-0 top-full mt-1 z-50 rounded-xl border shadow-lg overflow-hidden min-w-[160px] ${
    isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-gray-200'
  }`;
  const optionCls = (active: boolean) =>
    `w-full text-left px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
      active ? 'bg-gray-900 text-white' : isDark ? 'text-cv-blue-100 hover:bg-cv-blue-800' : 'text-gray-700 hover:bg-gray-50'
    }`;
  const chevron = (open: boolean) => (
    <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );

  // Trip type as a field-box (used on both mobile and desktop)
  const tripField = (
    <div className={`flex flex-col rounded-lg border px-3 py-2 ${fieldBoxCls}`}>
      <span className={`text-[9.5px] font-bold font-mono uppercase tracking-widest leading-none ${fieldLabelCls}`}>
        Trip
      </span>
      <div className="flex gap-1 mt-1.5">
        {(['roundtrip', 'oneway'] as TripType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTripType(t)}
            className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
              tripType === t
                ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                : isDark ? 'text-cv-blue-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'
            }`}
          >
            {t === 'roundtrip' ? 'Round trip' : 'One way'}
          </button>
        ))}
      </div>
    </div>
  );

  const searchButton = (
    <button
      onClick={handleSearch}
      disabled={!canSearch || flightSearch.isPending}
      className={`rounded-lg px-6 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isDark
          ? 'bg-cv-blue-600 hover:bg-cv-blue-400 focus:ring-cv-blue-600'
          : 'bg-gray-900 hover:bg-gray-700 focus:ring-gray-900'
      }`}
    >
      {flightSearch.isPending ? 'Searching…' : 'Search →'}
    </button>
  );

  const header = (
    <div className="w-full flex flex-col gap-2.5">

      {/* Mobile layout */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {tripField}
        <LocationSearch fieldLabel="From" forAirport onSelect={(p) => setOriginPlace(p)} onClear={() => setOriginPlace(null)} />
        <LocationSearch fieldLabel="To"   forAirport onSelect={(p) => setArrivalPlace(p)} onClear={() => setArrivalPlace(null)} />
        <div className="flex gap-2.5">
          <div className="flex-1"><DateInput label="Depart" value={startDate} onChange={setStartDate} /></div>
          {tripType === 'roundtrip' && (
            <div className="flex-1"><DateInput label="Return" value={endDate} onChange={setEndDate} min={startDate || undefined} /></div>
          )}
        </div>
        {searchButton}
      </div>

      {/* Desktop layout — single grid row */}
      <div
        className="hidden md:grid items-stretch gap-2.5"
        style={{ gridTemplateColumns: 'auto 1fr 1fr 150px 150px auto' }}
      >
        {tripField}

        <LocationSearch fieldLabel="From" forAirport onSelect={(p) => setOriginPlace(p)} onClear={() => setOriginPlace(null)} />

        <LocationSearch fieldLabel="To"   forAirport onSelect={(p) => setArrivalPlace(p)} onClear={() => setArrivalPlace(null)} />

        <DateInput label="Depart" value={startDate} onChange={setStartDate} />

        {/* Always in DOM so grid is stable; invisible when one-way */}
        <div className={tripType === 'oneway' ? 'invisible' : ''}>
          <DateInput label="Return" value={endDate} onChange={setEndDate} min={startDate || undefined} />
        </div>

        {searchButton}
      </div>

      {/* Filter row — desktop only */}
      <div className="hidden md:flex justify-end gap-2">
        <div className="relative" ref={cabinRef}>
          <button
            onClick={() => setCabinOpen(o => !o)}
            onBlur={(e) => { if (!cabinRef.current?.contains(e.relatedTarget as Node)) setCabinOpen(false); }}
            className={ghostBtn}
          >
            Cabin: {CABIN_LABELS[cabinClass]}
            {chevron(cabinOpen)}
          </button>
          {cabinOpen && (
            <div className={dropdownCls}>
              {(Object.keys(CABIN_LABELS) as CabinClass[]).map((c) => (
                <button key={c} onMouseDown={() => { setCabinClass(c); setCabinOpen(false); }} className={optionCls(c === cabinClass)}>
                  {CABIN_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>

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
              {(Object.keys(SORT_LABELS) as SortOrder[]).map((s) => (
                <button key={s} onMouseDown={() => { setSortOrder(s); setSortOpen(false); }} className={optionCls(s === sortOrder)}>
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );

  const headingCls = isDark ? 'text-white' : 'text-gray-900';
  const subTextCls = isDark ? 'text-cv-blue-400' : 'text-gray-500';

  return (
    <AppShell header={header} hasResults={offers.length > 0}>
      {flightSearch.isPending ? (
        <div className="flex items-center justify-center py-24">
          <svg className={`w-8 h-8 animate-spin ${isDark ? 'text-cv-blue-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : flightSearch.isError ? (
        <EmptyState message="Flight search failed. Check your selections and try again." />
      ) : offers.length > 0 ? (
        <div className="space-y-4">
          <div className={`flex items-end justify-between pb-3 border-b-2 ${isDark ? 'border-cv-blue-300' : 'border-gray-900'}`}>
            <div>
              <h2 className={`text-3xl font-extrabold tracking-tight leading-none ${headingCls}`}>
                {offers.length} flight{offers.length !== 1 ? 's' : ''} found
              </h2>
              <p className={`text-[10px] font-bold font-mono tracking-widest uppercase mt-2 ${subTextCls}`}>
                {originCode} → {arrivalCode} · {tripType === 'roundtrip' ? 'Round trip' : 'One way'} · {CABIN_LABELS[cabinClass]}
              </p>
            </div>
          </div>
          {offers.slice(0, 10).map((offer, i) => (
            <FlightCard key={`${offer.id}-${sortOrder}`} offer={offer} defaultCollapsed={i >= 2} />
          ))}
        </div>
      ) : flightSearch.isSuccess ? (
        <EmptyState message="No flights found for this route and date." />
      ) : (
        <EmptyState message={!originPlace || !arrivalPlace
          ? 'Select departure and arrival airports to search.'
          : 'Fill in dates and press Search.'} />
      )}
    </AppShell>
  );
}
