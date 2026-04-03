'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
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
    <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${isDark ? 'border-cv-blue-900' : 'border-cv-blue-200'}`}>
      <p className={`text-sm ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-500'}`}>{message}</p>
    </div>
  );
}

export default function FlightsPage() {
  const searchParams = useSearchParams();
  const paramDest      = searchParams.get('destination') ?? '';
  const paramDepart    = searchParams.get('departDate') ?? '';
  const paramReturn    = searchParams.get('returnDate') ?? '';
  const paramTripType  = (searchParams.get('tripType') as TripType | null) ?? 'roundtrip';

  const [tripType, setTripType]         = useState<TripType>(paramTripType);
  const [cabinClass, setCabinClass]     = useState<CabinClass>('economy');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('relevant');
  const [startDate, setStartDate]       = useState(paramDepart);
  const [endDate, setEndDate]           = useState(paramReturn);
  const [originPlace, setOriginPlace]   = useState<SelectedPlace | null>(null);
  const [arrivalPlace, setArrivalPlace] = useState<SelectedPlace | null>(null);
  // Used to remount the "To" LocationSearch with the resolved airport as committed value
  const [toKey, setToKey]               = useState(0);
  const [toInitial, setToInitial]       = useState(paramDest);
  const [toCommitted, setToCommitted]   = useState(false);

  const { isDark } = useTheme();

  // Auto-resolve nearest airport when coming from trip planner
  const { data: nearestAirport, isLoading: airportLoading } = useQuery({
    queryKey: ['places.nearestAirport', paramDest],
    queryFn: () => trpc.places.nearestAirport.query({ cityName: paramDest }),
    enabled: !!paramDest && !!paramDepart, // only when navigated from trip planner
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  useEffect(() => {
    if (!nearestAirport) return;
    setArrivalPlace({
      latitude: nearestAirport.latitude,
      longitude: nearestAirport.longitude,
      name: nearestAirport.name,
      description: nearestAirport.description,
      iataCode: nearestAirport.iataCode,
    });
    setToInitial(nearestAirport.description);
    // Only mark as committed (no auto-dropdown) if we got a usable IATA code.
    // If IATA is missing the user needs to pick from the dropdown themselves.
    setToCommitted(!!nearestAirport.iataCode);
    setToKey((k) => k + 1); // remount LocationSearch to show the resolved airport name
  }, [nearestAirport]);

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
  const todayStr    = new Date().toISOString().split('T')[0];
  const originCode  = originPlace?.iataCode ?? '';
  const arrivalCode = arrivalPlace?.iataCode ?? '';
  const canSearch   = originCode.length === 3 && arrivalCode.length === 3
    && !!startDate && startDate >= todayStr
    && (tripType === 'oneway' || (!!endDate && endDate >= startDate));

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

  const labelCls   = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const active     = 'bg-cv-blue-600 text-white';
  const inactive   = isDark ? 'bg-cv-blue-950 text-cv-blue-300 hover:bg-cv-blue-900' : 'bg-white text-cv-blue-900 hover:bg-cv-blue-50';
  const borderCls  = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const headingCls = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const subTextCls = isDark ? 'text-cv-blue-400' : 'text-cv-blue-500';

  const cabinRef = useRef<HTMLDivElement>(null);
  const sortRef  = useRef<HTMLDivElement>(null);
  const [cabinOpen, setCabinOpen] = useState(false);
  const [sortOpen, setSortOpen]   = useState(false);

  const filterRowCls = `flex items-center gap-1.5 text-xs font-medium transition-colors ${isDark ? 'text-cv-blue-400 hover:text-cv-blue-200' : 'text-cv-blue-600 hover:text-cv-blue-700'}`;
  const dropdownCls  = `absolute right-0 top-full mt-1 z-50 rounded-xl border shadow-lg overflow-hidden ${isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-cv-blue-100'}`;
  const optionCls    = (active: boolean) => `w-full text-left px-4 py-2 text-sm transition-colors whitespace-nowrap ${active ? 'bg-cv-blue-600 text-white' : isDark ? 'text-cv-blue-100 hover:bg-cv-blue-800' : 'text-cv-blue-950 hover:bg-cv-blue-50'}`;
  const chevron      = (open: boolean) => (
    <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );

  const cabinRow = (
    <div className="flex justify-end items-center gap-4 w-full pt-2 pb-1">
      {/* Cabin type */}
      <div className="relative" ref={cabinRef}>
        <button
          onClick={() => setCabinOpen(o => !o)}
          onBlur={(e) => { if (!cabinRef.current?.contains(e.relatedTarget as Node)) setCabinOpen(false); }}
          className={filterRowCls}
        >
          <span>Cabin type: {CABIN_LABELS[cabinClass]}</span>
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
            {(Object.keys(SORT_LABELS) as SortOrder[]).map((s) => (
              <button key={s} onMouseDown={() => { setSortOrder(s); setSortOpen(false); }} className={optionCls(s === sortOrder)}>
                {SORT_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const tripToggle = (
    <div className={`flex rounded-lg border overflow-hidden text-sm font-medium ${borderCls}`}>
      {(['roundtrip', 'oneway'] as TripType[]).map((t) => (
        <button key={t} onClick={() => setTripType(t)}
          className={`px-3 py-2 whitespace-nowrap transition-colors ${tripType === t ? active : inactive}`}>
          {t === 'roundtrip' ? 'Round trip' : 'One way'}
        </button>
      ))}
    </div>
  );

  const searchBtn = (full: boolean) => (
    <button onClick={handleSearch} disabled={!canSearch || flightSearch.isPending}
      className={`${full ? 'flex-1' : 'px-5'} py-2 rounded-lg bg-cv-blue-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cv-blue-400 transition-colors`}>
      {flightSearch.isPending ? 'Searching…' : 'Search'}
    </button>
  );

  const header = (
    <div className="w-full">

      {/* Mobile layout */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex flex-col gap-0.5">
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>From</span>
          <LocationSearch forAirport onSelect={(p) => setOriginPlace(p)} onClear={() => setOriginPlace(null)} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>
            To{airportLoading ? ' · resolving…' : ''}
          </span>
          <LocationSearch key={toKey} forAirport initialValue={toInitial} initialCommitted={toCommitted} onSelect={(p) => setArrivalPlace(p)} onClear={() => setArrivalPlace(null)} />
        </div>
        <div className="flex justify-between items-end gap-2">
          <DateInput label="Depart" value={startDate} onChange={setStartDate} min={todayStr} />
          {tripType === 'roundtrip' && (
            <DateInput label="Return" value={endDate} onChange={setEndDate} min={startDate || undefined} />
          )}
        </div>
        <div className="flex justify-between items-center gap-2">
          {tripToggle}
          {searchBtn(true)}
        </div>
        {cabinRow}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>Trip</span>
          {tripToggle}
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-40">
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>From</span>
          <LocationSearch forAirport onSelect={(p) => setOriginPlace(p)} onClear={() => setOriginPlace(null)} />
        </div>
        <div className="flex items-center pb-1">
          <span className="text-cv-blue-400 text-lg">→</span>
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-40">
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>
            To{airportLoading ? ' · resolving…' : ''}
          </span>
          <LocationSearch key={toKey} forAirport initialValue={toInitial} initialCommitted={toCommitted} onSelect={(p) => setArrivalPlace(p)} onClear={() => setArrivalPlace(null)} />
        </div>
        <DateInput label="Depart" value={startDate} onChange={setStartDate} />
        {tripType === 'roundtrip' && (
          <DateInput label="Return" value={endDate} onChange={setEndDate} min={startDate || undefined} />
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] opacity-0">·</span>
          {searchBtn(false)}
        </div>
      </div>
      <div className="hidden md:block">{cabinRow}</div>

    </div>
  );

  return (
    <AppShell header={header} hasResults={offers.length > 0}>
      {flightSearch.isPending ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-8 h-8 text-cv-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : flightSearch.isError ? (
        <EmptyState message="Flight search failed. Check your selections and try again." />
      ) : offers.length > 0 ? (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className={`text-xs font-semibold uppercase tracking-widest ${headingCls}`}>
              {offers.length} flight{offers.length !== 1 ? 's' : ''} found
            </h2>
            <span className={`text-xs ${subTextCls}`}>
              {originCode} → {arrivalCode} · {tripType === 'roundtrip' ? 'Round trip' : 'One way'}
            </span>
          </div>
          {offers.slice(0, 10).map((offer, i) => (
            <FlightCard key={`${offer.id}-${sortOrder}`} offer={offer} defaultCollapsed={i >= 2} />
          ))}
        </>
      ) : flightSearch.isSuccess ? (
        <EmptyState message="No flights found for this route and date." />
      ) : (
        <EmptyState message={
          !originPlace || !arrivalPlace
            ? 'Select departure and arrival airports to search.'
            : !startDate || startDate < todayStr
            ? 'Enter a valid departure date and press Search.'
            : 'Press Search to find flights.'
        } />
      )}
    </AppShell>
  );
}
