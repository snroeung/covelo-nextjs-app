'use client';

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell, MAIN_SCROLL_ID } from '@/components/AppShell';
import { FlightCard } from '@/components/FlightCard';
import { FlightSearchForm } from '@/components/search/FlightSearchForm';
import { type SelectedPlace } from '@/components/LocationSearch';
import { Pagination } from '@/components/Pagination';
import { AirlineGroupCard } from '@/components/AirlineGroupCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { usePerPage } from '@/hooks/usePerPage';
import { trpc } from '@/lib/trpc-client';
import { clampPage, paginate, pageRange } from '@/lib/pagination';
import { AffiliateAdSpot } from '@/components/offers/AffiliateAdSpot';
import { calcPoints } from '@/lib/points/calcPoints';
import { getOfferFlightInfo, getOfferTripDates, groupOffersByAirline, offerPriceRange } from '@/lib/flights/itinerary';
import { findLiveBonus } from '@/lib/points/transferBonus';
import { findLiveSpendingBonusForAirline } from '@/lib/points/spendingBonusMatch';

type TripType   = 'roundtrip' | 'oneway';
type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
type FlightSort = 'best' | 'cheap' | 'fast';

const CABIN_LABELS: Record<CabinClass, string> = {
  economy:         'Economy',
  premium_economy: 'Premium Economy',
  business:        'Business',
  first:           'First',
};

const SORT_TABS: { key: FlightSort; label: string }[] = [
  { key: 'best',  label: 'Best'  },
  { key: 'cheap', label: 'Cheap' },
  { key: 'fast',  label: 'Fast'  },
];

const STOP_LABELS: Record<number, string> = {
  0: 'Nonstop',
  1: '1 stop',
  2: '2+ stops',
};

function isoToMinutes(iso: string): number {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  return h * 60 + m;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function offerTotalMinutes(offer: any): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return offer.slices.reduce((sum: number, s: any) => sum + isoToMinutes(s.duration), 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMaxStops(offer: any): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Math.max(...offer.slices.map((s: any) => s.segments.length - 1));
}

// ---------------------------------------------------------------------------
// PriceTrendPlaceholder
// ---------------------------------------------------------------------------

function PriceTrendPlaceholder({ isDark }: { isDark: boolean }) {
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const bgCls     = isDark ? 'bg-gph-dark-bg'       : 'bg-gray-50';
  const mutedCls  = isDark ? 'text-gph-dark-muted'  : 'text-gray-600';
  const barCls    = isDark ? 'bg-gph-dark-linesoft'  : 'bg-gray-200';

  const heights = [55, 40, 60, 35, 30, 45, 65, 70, 50, 55, 72];

  return (
    <div className={`rounded-xl border px-5 py-4 mb-4 ${bgCls} ${borderCls}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`text-[9px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
            Price Trend
          </div>
          <div className={`text-xs font-mono mt-1 ${mutedCls}`}>
            Price history coming soon
          </div>
        </div>
        <span className={`text-[10px] font-bold font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border ${borderCls} ${mutedCls} shrink-0`}>
          Coming soon
        </span>
      </div>
      <div className="flex items-end gap-1 mt-4 h-10">
        {heights.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${barCls}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RefineDropdown
// ---------------------------------------------------------------------------

interface RefineProps {
  isDark: boolean;
  stopCounts: Record<number, number>;
  excludedStops: Set<number>;
  onToggleStop: (stop: number) => void;
  availableAirlines: { code: string; name: string; count: number }[];
  excludedAirlines: Set<string>;
  onToggleAirline: (code: string) => void;
  priceRange: { min: number; max: number };
  filterMaxPrice: number | null;
  onSetMaxPrice: (price: number | null) => void;
  filterCount: number;
  onClearAll: () => void;
  cabinClass: CabinClass;
  onCabinChange: (c: CabinClass) => void;
}

// Shared filter content — used by both the sidebar panel and the mobile dropdown
function RefineContent({
  isDark, stopCounts, excludedStops, onToggleStop,
  availableAirlines, excludedAirlines, onToggleAirline,
  priceRange, filterMaxPrice, onSetMaxPrice, filterCount, onClearAll,
  cabinClass, onCabinChange,
}: RefineProps) {
  const sliderMax   = priceRange.max > 0 ? Math.ceil(priceRange.max / 10) * 10 : 2000;
  const sliderValue = filterMaxPrice ?? sliderMax;

  const inkCls     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const mutedCls   = isDark ? 'text-gph-dark-muted' : 'text-gray-600';
  const rowIdleCls = isDark
    ? 'border-gph-dark-line text-gph-dark-muted hover:border-gph-dark-action hover:text-gph-dark-ink'
    : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-900';
  const rowOnCls = isDark
    ? 'border-gph-dark-action bg-gph-dark-linesoft text-gph-dark-ink'
    : 'border-gray-900 bg-gray-100 text-gray-900';

  const availableStopKeys = ([0, 1, 2] as const).filter(s => stopCounts[s] !== undefined);
  const [showAllAirlines, setShowAllAirlines] = useState(false);
  const visibleAirlines = showAllAirlines ? availableAirlines : availableAirlines.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        {filterCount > 0 && (
          <button
            onClick={onClearAll}
            className={`text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls} hover:text-red-500 transition-colors`}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Stops */}
      {availableStopKeys.length > 0 && (
        <div>
          <div className={`text-[10px] font-bold font-mono uppercase tracking-widest mb-2 ${mutedCls}`}>Stops</div>
          <div className="flex flex-col gap-1.5">
            {availableStopKeys.map((stop) => {
              const excluded = excludedStops.has(stop);
              return (
                <button
                  key={stop}
                  onClick={() => onToggleStop(stop)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${excluded ? rowIdleCls : rowOnCls}`}
                >
                  {/* line-through alone (no opacity dimming — that combination with
                      rowIdleCls's already-muted text fails WCAG AA contrast) */}
                  <span className={excluded ? 'line-through' : ''}>{STOP_LABELS[stop]}</span>
                  <span className={`text-[10px] font-mono font-bold ${mutedCls}`}>{stopCounts[stop]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Airlines */}
      {availableAirlines.length > 1 && (
        <div>
          <div className={`text-[10px] font-bold font-mono uppercase tracking-widest mb-2 ${mutedCls}`}>Airlines</div>
          <div className={`flex flex-col gap-1.5 ${showAllAirlines ? 'max-h-40 overflow-y-auto' : ''}`}>
            {visibleAirlines.map(({ code, name, count }) => {
              const excluded = excludedAirlines.has(code);
              return (
                <button
                  key={code}
                  onClick={() => onToggleAirline(code)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${excluded ? rowIdleCls : rowOnCls}`}
                >
                  <span className={excluded ? 'line-through' : ''}>{name}</span>
                  <span className={`text-[10px] font-mono font-bold ${mutedCls}`}>{count}</span>
                </button>
              );
            })}
          </div>
          {availableAirlines.length > 3 && (
            <button
              onClick={() => setShowAllAirlines(v => !v)}
              className={`mt-1.5 text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls} hover:${isDark ? 'text-gph-dark-ink' : 'text-gray-900'} transition-colors`}
            >
              {showAllAirlines ? 'Show less' : `Show ${availableAirlines.length - 3} more`}
            </button>
          )}
        </div>
      )}

      {/* Cabin */}
      <div>
        <div className={`text-[10px] font-bold font-mono uppercase tracking-widest mb-2 ${mutedCls}`}>Cabin</div>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(CABIN_LABELS) as CabinClass[]).map((c) => (
            <button
              key={c}
              onClick={() => onCabinChange(c)}
              className={`flex items-center px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${c === cabinClass ? rowOnCls : rowIdleCls}`}
            >
              {CABIN_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Max price */}
      {priceRange.max > priceRange.min && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>Max price</div>
            <div className={`text-sm font-bold font-mono ${inkCls}`}>
              {sliderValue >= sliderMax ? 'Any' : `$${sliderValue.toLocaleString()}`}
            </div>
          </div>
          <input
            type="range"
            aria-label="Max price"
            min={Math.floor(priceRange.min)}
            max={sliderMax}
            step={10}
            value={sliderValue}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              onSetMaxPrice(v >= sliderMax ? null : v);
            }}
            className={`w-full ${isDark ? 'accent-gph-dark-action' : 'accent-gray-900'}`}
          />
          <div className={`flex justify-between text-[9px] font-mono mt-1 ${mutedCls}`}>
            <span>${Math.floor(priceRange.min)}</span>
            <span>${sliderMax}+</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile-only dropdown button wrapping RefineContent
function RefineDropdown(props: RefineProps) {
  const { isDark, filterCount } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const isActive = open || filterCount > 0;
  const cardCls  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
          isActive
            ? isDark ? 'border-gph-dark-action bg-gph-dark-linesoft text-gph-dark-ink' : 'border-gray-900 bg-gray-100 text-gray-900'
            : isDark ? 'border-gph-dark-line text-gph-dark-muted hover:border-gph-dark-action hover:text-gph-dark-ink' : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
        }`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
        </svg>
        Refine
        {filterCount > 0 && (
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white'}`}>
            {filterCount}
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border shadow-xl p-4 ${cardCls}`}>
          <RefineContent {...props} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${isDark ? 'border-gph-dark-line' : 'border-gray-200'}`}>
      <p className={`text-sm ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page inner
// ---------------------------------------------------------------------------

function FlightsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramDest     = searchParams.get('destination') ?? '';
  const paramDestCode = searchParams.get('destinationCode') ?? ''; // IATA from /search hub
  const paramOrigin   = searchParams.get('origin') ?? '';          // IATA from /search hub
  const paramOriginNm = searchParams.get('originName') ?? '';
  const paramDepart   = searchParams.get('departDate')  ?? '';
  const paramReturn   = searchParams.get('returnDate')  ?? '';
  const paramTripType = (searchParams.get('tripType') as TripType | null) ?? 'roundtrip';

  // A place seeded from an IATA URL param — flight search only needs the code, not lat/lng.
  const seedFromIata = (code: string, name: string): SelectedPlace | null =>
    code.length === 3
      ? { latitude: 0, longitude: 0, name: name || code, description: name || code, iataCode: code }
      : null;

  const [tripType,     setTripType]     = useState<TripType>(paramTripType);
  const [cabinClass,   setCabinClass]   = useState<CabinClass>('economy');
  const [sort,         setSort]         = useState<FlightSort>('best');
  const [startDate,    setStartDate]    = useState(paramDepart);
  const [endDate,      setEndDate]      = useState(paramReturn);
  const [originPlace,  setOriginPlace]  = useState<SelectedPlace | null>(() => seedFromIata(paramOrigin, paramOriginNm));
  const [arrivalPlace, setArrivalPlace] = useState<SelectedPlace | null>(() => seedFromIata(paramDestCode, paramDest));
  const [fromInitial]                   = useState(paramOriginNm || paramOrigin);
  const [fromCommitted]                 = useState(paramOrigin.length === 3);
  const [toKey,        setToKey]        = useState(0);
  const [toInitial,    setToInitial]    = useState(paramDest);
  const [toCommitted,  setToCommitted]  = useState(paramDestCode.length === 3);

  // Refine filters
  const [excludedStops,    setExcludedStops]    = useState<Set<number>>(new Set());
  const [excludedAirlines, setExcludedAirlines] = useState<Set<string>>(new Set());
  const [filterMaxPrice,   setFilterMaxPrice]   = useState<number | null>(null);

  const { isDark } = useTheme();

  // Auto-resolve nearest airport when navigating from trip planner
  const { data: nearestAirport } = useQuery({
    queryKey: ['places.nearestAirport', paramDest],
    queryFn:  () => trpc.places.nearestAirport.query({ cityName: paramDest }),
    // Skip when the /search hub already handed us a resolved IATA code.
    enabled:  !!paramDest && !!paramDepart && paramDestCode.length !== 3,
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  // react-query keeps a stable reference for unchanged data across
  // re-renders, so this only fires once per actual new result — adjusted
  // during render (React's documented alternative to an effect for this).
  const [prevNearestAirport, setPrevNearestAirport] = useState(nearestAirport);
  if (nearestAirport !== prevNearestAirport) {
    setPrevNearestAirport(nearestAirport);
    if (nearestAirport) {
      setArrivalPlace({
        latitude:    nearestAirport.latitude,
        longitude:   nearestAirport.longitude,
        name:        nearestAirport.name,
        description: nearestAirport.description,
        iataCode:    nearestAirport.iataCode,
      });
      setToInitial(nearestAirport.description);
      setToCommitted(!!nearestAirport.iataCode);
      setToKey((k) => k + 1);
    }
  }

  // Committed search params drive the query. Seeded from the URL so arriving from the
  // /search hub runs the search declaratively. This deliberately replaces an
  // auto-fired mutation-in-useEffect: under React 18 StrictMode + Next soft navigation
  // that mutation resolves against the discarded mount and the live component stays
  // stuck on the spinner. A useQuery keyed on committed params is StrictMode/soft-nav safe.
  type FlightQueryVars = {
    origin: string; destination: string; departureDate: string;
    returnDate?: string; passengers: number; cabinClass: CabinClass;
  };
  const [committed, setCommitted] = useState<FlightQueryVars | null>(() =>
    paramOrigin.length === 3 && paramDestCode.length === 3 && paramDepart
      ? {
          origin: paramOrigin,
          destination: paramDestCode,
          departureDate: paramDepart,
          returnDate: paramTripType === 'roundtrip' && paramReturn ? paramReturn : undefined,
          passengers: 1,
          cabinClass: 'economy',
        }
      : null,
  );

  const flightSearch = useQuery({
    queryKey: ['flights.searchOffers', committed],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => trpc.flights.searchOffers.mutate(committed!) as Promise<any>,
    enabled: !!committed,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
  const searching = flightSearch.isFetching;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = usePerPage();
  const [drillPage, setDrillPage] = useState(1);

  // Reset filters when new results arrive — adjusted during render
  // (React's documented alternative to an effect for this).
  const [prevFlightSearchData, setPrevFlightSearchData] = useState(flightSearch.data);
  if (flightSearch.data !== prevFlightSearchData) {
    setPrevFlightSearchData(flightSearch.data);
    setExcludedStops(new Set());
    setExcludedAirlines(new Set());
    setFilterMaxPrice(null);
    setSort('best');
    setPage(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawOffers: any[] = useMemo(() => flightSearch.data?.offers ?? [], [flightSearch.data]);

  // Bonus/collection eligibility per offer — same three signals the per-card
  // banners already show (CollectionBanner, TransferBonusBanner), plus a live
  // spending bonus on the flight's airline. Used to float a bonus-eligible
  // fare to the front of its airline's group under 'best' sort, so an
  // airline's inline top card is its bonus fare whenever one exists, not
  // just its cheapest or fastest. Fetched once here rather than per-card so
  // filtering the whole result set doesn't require rendering every
  // FlightCard first; queryKeys match usePointsCalc/useLiveTransferBonus so
  // the cache is shared, not duplicated.
  const { selectedCards } = useSelectedCards();
  const { data: transferPartners } = useQuery({
    queryKey: ['portalData.transferPartners'],
    queryFn:  () => trpc.portalData.listTransferPartners.query(),
  });
  const { data: pointsValuations } = useQuery({
    queryKey: ['portalData.pointsValuations'],
    queryFn:  () => trpc.portalData.listPointsValuations.query(),
  });
  const { data: transferBonuses, dataUpdatedAt: transferBonusesUpdatedAt } = useQuery({
    queryKey: ['offers.transferBonuses'],
    queryFn:  () => trpc.offers.listTransferBonuses.query(),
  });
  const { data: spendingBonuses, dataUpdatedAt: spendingBonusesUpdatedAt } = useQuery({
    queryKey: ['offers.spendingBonuses'],
    queryFn:  () => trpc.offers.listSpendingBonuses.query(),
  });

  const featuredOfferIds = useMemo(() => {
    const ids = new Set<string>();
    for (const offer of rawOffers) {
      if (offer.collection) { ids.add(offer.id); continue; }

      const { airlineName, ptsCtx } = getOfferFlightInfo(offer);

      if (spendingBonuses && spendingBonusesUpdatedAt &&
          findLiveSpendingBonusForAirline(airlineName, spendingBonuses, spendingBonusesUpdatedAt)) {
        ids.add(offer.id);
        continue;
      }

      const totalAmount = parseFloat(offer.total_amount);
      if (!transferBonuses || !transferBonusesUpdatedAt || !(totalAmount > 0)) continue;
      try {
        const ptsResult = selectedCards.length === 0
          ? calcPoints(totalAmount, 'flight', undefined, ptsCtx, undefined, undefined, transferPartners, pointsValuations)
          : calcPoints(totalAmount, 'flight', selectedCards, ptsCtx, undefined, undefined, transferPartners, pointsValuations);
        if (ptsResult && findLiveBonus(ptsResult, transferBonuses, transferBonusesUpdatedAt, getOfferTripDates(offer))) {
          ids.add(offer.id);
        }
      } catch {
        // calcPoints can throw on a malformed price/context — not featured.
      }
    }
    return ids;
  }, [rawOffers, selectedCards, transferPartners, pointsValuations, transferBonuses, transferBonusesUpdatedAt, spendingBonuses, spendingBonusesUpdatedAt]);

  // Derived filter data (from full result set)
  const stopCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rawOffers.forEach(o => {
      const bucket = Math.min(getMaxStops(o), 2);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    });
    return counts;
  }, [rawOffers]);

  const availableAirlines = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    rawOffers.forEach(o => {
      const code = o.owner?.iata_code ?? '';
      const name = o.owner?.name ?? code;
      if (!code) return;
      const prev = map.get(code);
      map.set(code, { name, count: (prev?.count ?? 0) + 1 });
    });
    return Array.from(map.entries())
      .map(([code, { name, count }]) => ({ code, name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rawOffers]);

  const priceRange = useMemo(() => {
    if (!rawOffers.length) return { min: 0, max: 0 };
    const prices = rawOffers.map(o => parseFloat(o.total_amount));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [rawOffers]);

  // Filter + sort
  const offers = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result = rawOffers.filter((offer: any) => {
      const bucket = Math.min(getMaxStops(offer), 2);
      if (excludedStops.has(bucket)) return false;
      const code = offer.owner?.iata_code ?? '';
      if (excludedAirlines.has(code)) return false;
      if (filterMaxPrice !== null && parseFloat(offer.total_amount) > filterMaxPrice) return false;
      return true;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = [...result].sort((a: any, b: any) => {
      if (sort === 'cheap') return parseFloat(a.total_amount) - parseFloat(b.total_amount);
      if (sort === 'fast') return offerTotalMinutes(a) - offerTotalMinutes(b);
      // 'best' = float featured (collection/bonus match) flights first, then Duffel's default ranking
      const aFeatured = featuredOfferIds.has(a.id);
      const bFeatured = featuredOfferIds.has(b.id);
      if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
      return 0;
    });

    return result;
  }, [rawOffers, sort, excludedStops, excludedAirlines, filterMaxPrice, featuredOfferIds]);

  // One group per airline: a top pick (the airline's first, i.e. best-ranked,
  // offer under the active sort — bonus-eligible fares already float first
  // under 'best' via the featuredOfferIds tie-break above) plus every other
  // offer from that airline. Replaces the old separate "Featured flights"
  // strip: every airline now gets exactly one inline top card, bonus-forward
  // when a bonus applies, instead of only bonus-eligible airlines getting a
  // deduped highlight slot. The rest fold into that airline's group card
  // rather than disappearing or flooding the list with repeats.
  const airlineGroups = useMemo(() => groupOffersByAirline(offers), [offers]);

  // The drill-down view: ?airline=<key> on this same route shows every offer
  // for one airline (its group's top + rest) instead of the grouped list —
  // a real, linkable, back-button-safe view without a second fetch or a
  // second route, since the already-fetched `offers` already has everything
  // it needs.
  const drillAirlineKey = searchParams.get('airline');
  const drillGroup = useMemo(
    () => (drillAirlineKey ? airlineGroups.find((g) => g.key === drillAirlineKey) ?? null : null),
    [airlineGroups, drillAirlineKey],
  );
  const drillOffers = useMemo(
    () => (drillGroup ? [drillGroup.top, ...drillGroup.rest] : []),
    [drillGroup],
  );

  function drillHref(key: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set('airline', key);
    return `/flights?${params.toString()}`;
  }
  const allAirlinesHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('airline');
    return `/flights?${params.toString()}`;
  })();

  // The Refine sidebar's airline checkboxes while drilled into one airline:
  // only that airline reads as selected, regardless of whatever exclude-set
  // was live on the grouped view before the user clicked in — the drilled
  // page is scoped to exactly one airline, so the sidebar should say so.
  // excludedAirlines itself is left untouched here; this is a display-only
  // override for the Airlines section, swapped back in below alongside a
  // toggle handler that turns a second selection into a real filter.
  const drillDisplayExcludedAirlines = useMemo(
    () => (drillAirlineKey
      ? new Set(availableAirlines.map((a) => a.code).filter((code) => code !== drillAirlineKey))
      : excludedAirlines),
    [drillAirlineKey, availableAirlines, excludedAirlines],
  );

  // Selecting a second airline while drilled "promotes" back to the grouped
  // view with both (or more) airlines applied as a real filter — the
  // drill-down was never a separate filter mode, just a one-airline view of
  // the same list, so gaining a second selection collapses it back into that
  // list scoped accordingly. Unselecting the only airline (the drilled one
  // itself) is equivalent to the "← All airlines" link: back to the grouped
  // view with no airline filter at all.
  function toggleDrillAirline(code: string) {
    if (!drillAirlineKey) return;
    if (code === drillAirlineKey) {
      setExcludedAirlines(new Set());
    } else {
      const included = new Set([drillAirlineKey, code]);
      setExcludedAirlines(new Set(availableAirlines.map((a) => a.code).filter((c) => !included.has(c))));
    }
    router.push(allAirlinesHref);
    scrollMainToTop();
  }

  // Reset to page 1 whenever the filtered/sorted list's shape changes — covers
  // filter and sort changes that don't produce a new flightSearch.data identity.
  const listKey = `${sort}|${filterMaxPrice}|${[...excludedStops].sort().join(',')}|${[...excludedAirlines].sort().join(',')}`;
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (listKey !== prevListKey) {
    setPrevListKey(listKey);
    setPage(1);
  }

  // The drill-down list pages independently, and resets whenever the airline
  // being drilled into changes (including leaving/entering drill-down).
  const [prevDrillAirlineKey, setPrevDrillAirlineKey] = useState(drillAirlineKey);
  if (drillAirlineKey !== prevDrillAirlineKey) {
    setPrevDrillAirlineKey(drillAirlineKey);
    setDrillPage(1);
  }

  const safePage = clampPage(page, airlineGroups.length, perPage);
  const pageGroups = paginate(airlineGroups, safePage, perPage);
  const { from, to } = pageRange(airlineGroups.length, safePage, perPage);

  const safeDrillPage = clampPage(drillPage, drillOffers.length, perPage);
  const drillPageOffers = paginate(drillOffers, safeDrillPage, perPage);
  const { from: drillFrom, to: drillTo } = pageRange(drillOffers.length, safeDrillPage, perPage);

  function goToPage(next: number) {
    setPage(next);
    document.getElementById(MAIN_SCROLL_ID)?.scrollTo({ top: 0 });
  }

  function goToDrillPage(next: number) {
    setDrillPage(next);
    document.getElementById(MAIN_SCROLL_ID)?.scrollTo({ top: 0 });
  }

  function scrollMainToTop() {
    document.getElementById(MAIN_SCROLL_ID)?.scrollTo({ top: 0 });
  }

  const filterCount =
    (excludedStops.size > 0 ? 1 : 0) +
    // Drilled-into-one-airline reads as an active airline filter too, even
    // when the real excludedAirlines set (pre-drill) happens to be empty.
    ((drillAirlineKey ? availableAirlines.length > 1 : excludedAirlines.size > 0) ? 1 : 0) +
    (filterMaxPrice !== null ? 1 : 0);

  const todayStr    = new Date().toISOString().split('T')[0];
  const originCode  = originPlace?.iataCode ?? '';
  const arrivalCode = arrivalPlace?.iataCode ?? '';
  const canSearch   = originCode.length === 3 && arrivalCode.length === 3
    && !!startDate && startDate >= todayStr
    && (tripType === 'oneway' || (!!endDate && endDate >= startDate));

  // Committing new params changes the query key → useQuery fetches. Arriving from the
  // /search hub is handled by seeding `committed` above, so no auto-run effect is needed.
  function handleSearch() {
    if (!canSearch) return;
    setCommitted({
      origin:       originCode,
      destination:  arrivalCode,
      departureDate: startDate,
      returnDate:   tripType === 'roundtrip' && endDate ? endDate : undefined,
      passengers:   1,
      cabinClass,
    });
  }

  // Cabin isn't a client-side filter like stops/airlines — Duffel prices per cabin at
  // search time, so switching cabin re-runs the search instead of just updating state.
  function handleCabinChange(c: CabinClass) {
    setCabinClass(c);
    if (committed) setCommitted({ ...committed, cabinClass: c });
  }

  const header = (
    <FlightSearchForm
      tripType={tripType}
      onTripTypeChange={setTripType}
      onOriginSelect={setOriginPlace}
      onOriginClear={() => setOriginPlace(null)}
      originInitialValue={fromInitial}
      originInitialCommitted={fromCommitted}
      onArrivalSelect={setArrivalPlace}
      onArrivalClear={() => setArrivalPlace(null)}
      arrivalInitialValue={toInitial}
      arrivalInitialCommitted={toCommitted}
      arrivalFieldKey={toKey}
      startDate={startDate}
      onStartDateChange={setStartDate}
      endDate={endDate}
      onEndDateChange={setEndDate}
      onSearch={handleSearch}
      searchDisabled={!canSearch}
      searchPending={searching}
    />
  );

  const headingCls = isDark ? 'text-white'           : 'text-gray-900';
  const subTextCls = isDark ? 'text-gph-dark-muted'  : 'text-gray-600';
  const borderAccent = isDark ? 'border-gph-dark-action' : 'border-gray-900';

  const refineProps: RefineProps = {
    isDark,
    stopCounts,
    excludedStops,
    onToggleStop: (stop) => setExcludedStops(prev => {
      const next = new Set(prev);
      if (next.has(stop)) next.delete(stop); else next.add(stop);
      return next;
    }),
    availableAirlines,
    excludedAirlines: drillDisplayExcludedAirlines,
    onToggleAirline: drillAirlineKey ? toggleDrillAirline : (code) => setExcludedAirlines(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    }),
    priceRange,
    filterMaxPrice,
    onSetMaxPrice: setFilterMaxPrice,
    filterCount,
    onClearAll: () => {
      setExcludedStops(new Set());
      setExcludedAirlines(new Set());
      setFilterMaxPrice(null);
      if (drillAirlineKey) {
        router.push(allAirlinesHref);
        scrollMainToTop();
      }
    },
    cabinClass,
    onCabinChange: handleCabinChange,
  };

  return (
    <AppShell
      header={header}
      hasResults={rawOffers.length > 0}
      sidebar={rawOffers.length > 0 ? <RefineContent {...refineProps} /> : undefined}
    >
      <h1 className="sr-only">Flight search results</h1>
      {searching ? (
        <div className="flex items-center justify-center py-24">
          <svg className={`w-8 h-8 animate-spin ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>

      ) : flightSearch.isError ? (
        <EmptyState message="Flight search failed. Check your selections and try again." />

      ) : rawOffers.length > 0 ? (
        <div className="space-y-4">

          {/* Price trend placeholder */}
          <PriceTrendPlaceholder isDark={isDark} />

          {drillAirlineKey && (
            <Link
              href={allAirlinesHref}
              onClick={scrollMainToTop}
              className={`inline-flex items-center gap-1.5 min-h-11 px-1 -mx-1 text-sm font-semibold transition-colors ${
                isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ← All airlines
            </Link>
          )}

          {/* Results header: count + sort tabs + Refine */}
          <div className={`flex items-end justify-between pb-3 border-b-2 gap-3 ${borderAccent}`}>
            <div className="min-w-0">
              <h2 className={`text-2xl font-extrabold tracking-tight leading-none ${headingCls}`}>
                {drillAirlineKey ? (
                  <>All {drillOffers.length} flight{drillOffers.length !== 1 ? 's' : ''} from {drillGroup?.airlineName ?? drillAirlineKey}</>
                ) : (
                  <>
                    {offers.length !== rawOffers.length
                      ? `${offers.length} of ${rawOffers.length}`
                      : rawOffers.length}{' '}
                    flight{rawOffers.length !== 1 ? 's' : ''}
                  </>
                )}
                {' · '}{committed?.origin} → {committed?.destination}
              </h2>
              <p className={`text-[10px] font-bold font-mono tracking-widest uppercase mt-1.5 ${subTextCls}`}>
                {startDate} · {tripType === 'roundtrip' ? 'Round trip' : 'One way'} · {CABIN_LABELS[cabinClass]}
                {drillAirlineKey
                  ? drillOffers.length > 0 && ` · Showing ${drillFrom}–${drillTo} of ${drillOffers.length} flights`
                  : offers.length > 0 && ` · Showing ${from}–${to} of ${airlineGroups.length} airlines`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Sort tabs */}
              <div className={`hidden sm:flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-gph-dark-line' : 'border-gray-200'}`}>
                {SORT_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-widest transition-colors ${
                      sort === key
                        ? isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white'
                        : isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Refine dropdown — mobile only */}
              <RefineDropdown {...refineProps} />
            </div>
          </div>

          {/* Flight results — one drilled-into airline's full list, or the grouped "top pick per airline" list */}
          {drillAirlineKey ? (
            !drillGroup ? (
              <EmptyState message="No flights from this airline match your current filters." />
            ) : (
              <>
                {drillPageOffers.map((offer, i) => (
                  <Fragment key={offer.id}>
                    <FlightCard offer={offer} />
                    {i === 1 && drillPageOffers.length >= 3 && (
                      <AffiliateAdSpot
                        slot="flights_inline"
                        variant="inline_banner"
                        isDark={isDark}
                        context={{ route: [originCode, arrivalCode].filter(Boolean) }}
                      />
                    )}
                  </Fragment>
                ))}

                <Pagination
                  page={safeDrillPage}
                  perPage={perPage}
                  totalItems={drillOffers.length}
                  onPageChange={goToDrillPage}
                  onPerPageChange={setPerPage}
                  isDark={isDark}
                  itemLabel="flight"
                  idPrefix="flights-drill"
                />
              </>
            )
          ) : offers.length === 0 ? (
            <EmptyState message="No flights match your filters. Try adjusting Refine." />
          ) : (
            <>
              {pageGroups.map((group, i) => {
                const rest = offerPriceRange(group.rest);
                return (
                  <Fragment key={group.key}>
                    <FlightCard offer={group.top} />
                    {group.rest.length > 0 && (
                      <AirlineGroupCard
                        isDark={isDark}
                        airlineName={group.airlineName}
                        airlineIata={group.airlineIata}
                        count={group.rest.length}
                        minPrice={rest.min}
                        maxPrice={rest.max}
                        href={drillHref(group.key)}
                        onNavigate={scrollMainToTop}
                      />
                    )}
                    {i === 1 && pageGroups.length >= 3 && (
                      <AffiliateAdSpot
                        slot="flights_inline"
                        variant="inline_banner"
                        isDark={isDark}
                        context={{ route: [originCode, arrivalCode].filter(Boolean) }}
                      />
                    )}
                  </Fragment>
                );
              })}

              <Pagination
                page={safePage}
                perPage={perPage}
                totalItems={airlineGroups.length}
                onPageChange={goToPage}
                onPerPageChange={setPerPage}
                isDark={isDark}
                itemLabel="airline"
                idPrefix="flights"
              />
            </>
          )}
        </div>

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

export default function FlightsPage() {
  return (
    <Suspense>
      <FlightsPageInner />
    </Suspense>
  );
}
