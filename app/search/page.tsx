'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { NavBar } from '@/components/layout/NavBar';
import { Footer } from '@/components/layout/Footer';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { CARD_PORTAL_MAP, type PortalId } from '@/lib/points/types';
import { SearchModeToggle, type SearchMode } from '@/components/search/SearchModeToggle';
import { FlightSearchForm } from '@/components/search/FlightSearchForm';
import { HotelSearchForm } from '@/components/search/HotelSearchForm';
import { LocationUnavailableBanner } from '@/components/search/LocationUnavailableBanner';
import { useLocationUnavailable } from '@/hooks/useLocationUnavailable';
import { SearchBoard, adaptFlightOffer, adaptStay, FALLBACK_FLIGHTS, FALLBACK_STAYS, type BoardCard, type FlightOfferSlice, type StaySearchResultSlice } from '@/components/search/SearchBoard';
import type { GuestsValue } from '@/components/inputs/GuestsDropdown';
import type { LocationSearchHandle, SelectedPlace } from '@/components/inputs/LocationSearch';
import { isResolved, resolvePlace } from '@/lib/resolvePlace';
import {
  buildFlightSearchUrl,
  buildHotelSearchUrl,
  type TripType,
} from '@/lib/searchUrls';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Example-board: one-way departures from Philadelphia to a spread of destinations.
const BOARD_ORIGIN = 'PHL';
const BOARD_DESTINATIONS = ['SFO', 'LAX', 'ICN', 'MUC', 'LBG', 'HND'];
const PHILLY = { latitude: 39.9526, longitude: -75.1652 };

const PORTAL_ORDER: PortalId[] = ['chase', 'amex', 'c1', 'bilt', 'citi'];
const PORTAL_BRAND: Record<PortalId, string> = {
  chase: 'Chase',
  amex:  'Amex',
  c1:    'Capital One',
  bilt:  'Bilt',
  citi:  'Citi',
};

function SearchHome() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { selectedCards, cardBalances } = useSelectedCards();

  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState<SearchMode>('flights');

  // Location-service health → page-top alarm (stable, polled; see useLocationUnavailable).
  const locationUnavailable = useLocationUnavailable();

  // Flight form state
  const [tripType, setTripType]         = useState<TripType>('roundtrip');
  const [originPlace, setOriginPlace]   = useState<SelectedPlace | null>(null);
  const [arrivalPlace, setArrivalPlace] = useState<SelectedPlace | null>(null);
  const [originText, setOriginText]     = useState('');
  const [arrivalText, setArrivalText]   = useState('');
  const [departDate, setDepartDate]     = useState('');
  const [returnDate, setReturnDate]     = useState('');

  // Hotel form state
  const [destPlace, setDestPlace] = useState<SelectedPlace | null>(null);
  const [destText, setDestText]   = useState('');
  const [checkIn, setCheckIn]     = useState('');
  const [checkOut, setCheckOut]   = useState('');
  const [guests, setGuests]       = useState<GuestsValue>({ adults: 2, children: 0, pets: 0 });

  // Resolve on submit: a field the user typed in but didn't pick from is resolved only when
  // they press Search (see resolvePlace) — never per keystroke.
  const [resolving, setResolving]     = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const originRef  = useRef<LocationSearchHandle>(null);
  const arrivalRef = useRef<LocationSearchHandle>(null);
  const destRef    = useRef<LocationSearchHandle>(null);

  // The forms are rendered conditionally, so switching Flights ⇄ Hotels remounts the
  // location fields empty. Reset the matching state so nothing hidden (a typed text, a
  // picked place, a "No match" note) can drive a search or linger on screen.
  function changeMode(next: SearchMode) {
    setMode(next);
    setOriginPlace(null);  setOriginText('');
    setArrivalPlace(null); setArrivalText('');
    setDestPlace(null);    setDestText('');
    setSubmitError(null);
  }

  // A field is ready when a place was picked, or there's typed text to resolve on submit.
  const fieldReady = (p: SelectedPlace | null, text: string, forAirport: boolean) =>
    isResolved(p, forAirport) || text.trim().length >= 2;

  const flightValues = {
    originCode:      originPlace?.iataCode ?? '',
    originName:      originPlace?.description ?? '',
    destinationCode: arrivalPlace?.iataCode ?? '',
    destinationName: arrivalPlace?.description ?? '',
    departDate,
    returnDate: tripType === 'oneway' ? '' : returnDate,
    tripType,
  };

  // Dates still gate strictly; each location can be a picked place OR typed text that's
  // resolved on submit.
  const hotelDatesOk  = !!checkIn && checkIn >= today && !!checkOut && checkOut > checkIn;
  const flightDatesOk = !!departDate && departDate >= today &&
    (tripType === 'oneway' || (!!returnDate && returnDate >= departDate));
  const flightsValid = flightDatesOk && !resolving
    && fieldReady(originPlace, originText, true) && fieldReady(arrivalPlace, arrivalText, true);
  const hotelsValid  = hotelDatesOk && !resolving && fieldReady(destPlace, destText, false);

  // No-match is the only case with an inline note; an outage stays silent (the banner covers it).
  async function submitHotels() {
    setSubmitError(null);
    setResolving(true);
    try {
      const r = await resolvePlace({ picked: destPlace, text: destText, field: destRef.current, forAirport: false });
      if (r.kind === 'no-match') { setSubmitError(`No match for "${destText.trim()}"`); return; }
      if (r.kind === 'unavailable') return;
      router.push(buildHotelSearchUrl({
        destinationName: r.place.description ?? r.place.name,
        latitude: r.place.latitude, longitude: r.place.longitude,
        checkIn, checkOut, rooms: 1, adults: guests.adults, children: guests.children,
      }));
    } finally {
      setResolving(false);
    }
  }

  async function submitFlights() {
    setSubmitError(null);
    setResolving(true);
    try {
      const [o, a] = await Promise.all([
        resolvePlace({ picked: originPlace,  text: originText,  field: originRef.current,  forAirport: true }),
        resolvePlace({ picked: arrivalPlace, text: arrivalText, field: arrivalRef.current, forAirport: true }),
      ]);
      const missed = o.kind === 'no-match' ? originText : a.kind === 'no-match' ? arrivalText : null;
      if (missed !== null) { setSubmitError(`No match for "${missed.trim()}"`); return; }
      if (o.kind !== 'place' || a.kind !== 'place') return;
      router.push(buildFlightSearchUrl({
        ...flightValues,
        originCode:      o.place.iataCode ?? '', originName:      o.place.description,
        destinationCode: a.place.iataCode ?? '', destinationName: a.place.description,
      }));
    } finally {
      setResolving(false);
    }
  }

  // ── Example board: cache-first (Redis → Duffel) via the existing tRPC search.
  const bDepart = useMemo(() => addDays(21), []);
  const bReturn = useMemo(() => addDays(24), []);

  // Single server-side fan-out, whole-board cached 24h (see flights.board). One request,
  // one cheapest offer per route — no per-visit Duffel calls competing with real searches.
  const flightBoard = useQuery({
    queryKey: ['searchBoard.flights', BOARD_ORIGIN, bDepart],
    queryFn: () => trpc.flights.board.query({ origin: BOARD_ORIGIN, destinations: BOARD_DESTINATIONS, departureDate: bDepart }),
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
  const stayBoard = useQuery({
    queryKey: ['searchBoard.stays', PHILLY.latitude, PHILLY.longitude, bDepart, bReturn],
    queryFn: () => trpc.stays.search.mutate({
      latitude: PHILLY.latitude, longitude: PHILLY.longitude,
      checkInDate: bDepart, checkOutDate: bReturn,
      guests: [{ type: 'adult' }, { type: 'adult' }],
    }),
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  const flightCards: BoardCard[] = useMemo(
    () => ((flightBoard.data as FlightOfferSlice[] | undefined) ?? []).map(adaptFlightOffer).filter((c: BoardCard | null): c is BoardCard => c !== null),
    [flightBoard.data],
  );
  const nights = useMemo(() => Math.max(1, Math.round((Date.parse(bReturn) - Date.parse(bDepart)) / 86400000)), [bDepart, bReturn]);
  const stayCards: BoardCard[] = useMemo(
    () => ((stayBoard.data as StaySearchResultSlice[] | undefined) ?? []).map((sr) => adaptStay(sr, nights)).filter((c: BoardCard | null): c is BoardCard => c !== null).slice(0, 8),
    [stayBoard.data, nights],
  );

  const isFlights = mode === 'flights';
  const boardLoading = isFlights ? flightBoard.isLoading : stayBoard.isLoading;
  // Live cache-first results win; fall back to curated examples when empty.
  const liveItems = isFlights ? flightCards : stayCards;
  const boardItems = liveItems.length > 0 ? liveItems : (isFlights ? FALLBACK_FLIGHTS : FALLBACK_STAYS);

  const pageBg = isDark ? 'bg-gph-dark-bg' : 'bg-gray-100';
  const surface = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const tray    = isDark ? 'bg-gph-dark-bg border-gph-dark-line' : 'bg-gray-100 border-gray-200';
  const ink = isDark ? 'text-gph-dark-ink' : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-600';

  // "Searching with" chips: signed-in users see the issuers they selected + their
  // points (entered in the profile popup); everyone else sees all brands, no points.
  const wallet = (() => {
    const loggedInWithCards = !!user && selectedCards.length > 0;
    if (!loggedInWithCards) {
      return PORTAL_ORDER.map((p) => ({ label: PORTAL_BRAND[p], points: null as number | null }));
    }
    const totals = new Map<PortalId, number>();
    for (const id of selectedCards) {
      const portal = CARD_PORTAL_MAP[id];
      totals.set(portal, (totals.get(portal) ?? 0) + (cardBalances[id] ?? 0));
    }
    return PORTAL_ORDER.filter((p) => totals.has(p)).map((p) => ({ label: PORTAL_BRAND[p], points: totals.get(p)! }));
  })();

  return (
    <div className={`min-h-screen flex flex-col ${pageBg}`}>
      <LocationUnavailableBanner show={locationUnavailable} />
      <NavBar />

      <main className="w-full px-4 md:px-8 py-8 md:py-12 flex-1">
        {/* White hub panel: hero + search + wallet */}
        <div className={`rounded-2xl border p-5 md:p-8 ${surface}`}>
        {/* Hero */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6">
          <div>
            <div className={`text-[11px] font-mono font-bold uppercase tracking-widest ${muted}`}>
              Search · every portal, one query
            </div>
            <h1 className={`mt-3 text-4xl md:text-5xl font-bold tracking-tight ${ink}`}>
              {isFlights ? 'Find your flight' : 'Find your stay'}
            </h1>
            <p className={`mt-3 max-w-xl text-sm md:text-base ${muted}`}>
              Search cash and points side by side across every travel portal — ranked by true
              cents-per-point value.
            </p>
          </div>
          <SearchModeToggle mode={mode} onChange={changeMode} />
        </div>

        {/* Search tray (inset within the panel) */}
        <div className={`rounded-xl border p-4 md:p-5 ${tray}`}>
          {isFlights ? (
            <FlightSearchForm
              tripType={tripType}
              onTripTypeChange={setTripType}
              onOriginSelect={setOriginPlace}
              onOriginClear={() => setOriginPlace(null)}
              onOriginTextChange={(t) => { setOriginText(t); setOriginPlace(null); setSubmitError(null); }}
              originRef={originRef}
              onArrivalSelect={setArrivalPlace}
              onArrivalClear={() => setArrivalPlace(null)}
              onArrivalTextChange={(t) => { setArrivalText(t); setArrivalPlace(null); setSubmitError(null); }}
              arrivalRef={arrivalRef}
              startDate={departDate}
              onStartDateChange={setDepartDate}
              endDate={returnDate}
              onEndDateChange={setReturnDate}
              onSearch={submitFlights}
              searchDisabled={!flightsValid}
              searchPending={resolving}
            />
          ) : (
            <HotelSearchForm
              onDestSelect={setDestPlace}
              onDestClear={() => setDestPlace(null)}
              onDestTextChange={(t) => { setDestText(t); setDestPlace(null); setSubmitError(null); }}
              destRef={destRef}
              checkIn={checkIn}
              onCheckInChange={setCheckIn}
              checkOut={checkOut}
              onCheckOutChange={setCheckOut}
              guests={guests}
              onGuestsChange={setGuests}
              onSearch={submitHotels}
              searchDisabled={!hotelsValid}
              searchPending={resolving}
            />
          )}
          {submitError && (
            <p role="alert" className={`mt-2 px-1 text-xs ${isDark ? 'text-cv-amber-400' : 'text-cv-amber-900'}`}>{submitError}</p>
          )}
        </div>

        {/* Wallet strip */}
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>Searching with</span>
          {wallet.map(({ label, points }) => (
            <span key={label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${tray}`}>
              <span className="w-1.5 h-1.5 rounded-sm bg-cv-lime-500" />
              <span className={`font-bold ${ink}`}>{label}</span>
              {points !== null && <span className={`font-mono ${muted}`}>{points.toLocaleString()}</span>}
            </span>
          ))}
        </div>
        </div>

        {/* Example board */}
        <div className="mt-8">
          <div className={`flex items-end justify-between pb-3 mb-4 border-b ${isDark ? 'border-gph-dark-line' : 'border-gray-300'}`}>
            <div>
              <div className={`text-xl font-bold tracking-tight ${ink}`}>
                {isFlights ? 'Example routes · Philadelphia departures' : 'Example stays · Philadelphia'}
              </div>
              <div className={`text-[11px] font-mono uppercase tracking-widest mt-1 ${muted}`}>Live board</div>
            </div>
          </div>
          <SearchBoard items={boardItems} loading={boardLoading} />

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchHome />
    </Suspense>
  );
}
