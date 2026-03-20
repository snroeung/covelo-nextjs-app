'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { DateInput } from '@/components/DateInput';
import { FlightCard } from '@/components/FlightCard';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';

type TripType = 'roundtrip' | 'oneway';

function EmptyState({ message }: { message: string }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${isDark ? 'border-cv-blue-900' : 'border-cv-blue-200'}`}>
      <p className={`text-sm ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-500'}`}>{message}</p>
    </div>
  );
}

export default function FlightsPage() {
  const [tripType, setTripType]         = useState<TripType>('roundtrip');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [originPlace, setOriginPlace]   = useState<SelectedPlace | null>(null);
  const [arrivalPlace, setArrivalPlace] = useState<SelectedPlace | null>(null);

  const { isDark } = useTheme();

  const flightSearch = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (vars: any) => trpc.flights.searchOffers.mutate(vars),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offers: any[] = flightSearch.data?.offers ?? [];
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
    });
  }

  const labelCls   = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const active     = 'bg-cv-blue-600 text-white';
  const inactive   = isDark ? 'bg-cv-blue-950 text-cv-blue-300 hover:bg-cv-blue-900' : 'bg-white text-cv-blue-900 hover:bg-cv-blue-50';
  const borderCls  = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const headingCls = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const subTextCls = isDark ? 'text-cv-blue-400' : 'text-cv-blue-500';

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
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>To</span>
          <LocationSearch forAirport onSelect={(p) => setArrivalPlace(p)} onClear={() => setArrivalPlace(null)} />
        </div>
        <div className="flex gap-2">
          <DateInput label="Depart" value={startDate} onChange={setStartDate} />
          {tripType === 'roundtrip' && (
            <DateInput label="Return" value={endDate} onChange={setEndDate} min={startDate || undefined} />
          )}
        </div>
        <div className="flex gap-2 items-center">
          {tripToggle}
          {searchBtn(true)}
        </div>
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
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>To</span>
          <LocationSearch forAirport onSelect={(p) => setArrivalPlace(p)} onClear={() => setArrivalPlace(null)} />
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

    </div>
  );

  return (
    <AppShell header={header}>
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
          {offers.slice(0, 10).map((offer) => (
            <FlightCard key={offer.id} offer={offer} />
          ))}
        </>
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
