'use client';

import { Fragment, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { CollectionBanner } from '@/components/CollectionBanner';
import { TransferBonusBanner } from '@/components/TransferBonusBanner';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { AddToTripButton } from '@/components/AddToTripButton';
import { ResultSummaryHeader } from '@/components/ResultSummaryHeader';
import { CompareModal } from '@/components/booking/CompareModal';
import { useRankedViews } from '@/hooks/useRankedViews';
import { flightQuoteDates, flightSubjectKey } from '@/lib/reports/subject';
import type { OptionRowView } from '@/lib/points/rowView';
import { buildRouteViews, getAirlineColor, getOfferFlightInfo, getOfferTripDates, itineraryMeta, totalTripDuration, type RouteView } from '@/lib/flights/itinerary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.4} aria-hidden="true"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Origin dot → a dot per connection → arrowhead at the destination. */
function RouteLine({ isDark, stops }: { isDark: boolean; stops: number }) {
  const color = isDark ? '#262629' : '#d1d5db';
  const dot = <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />;
  const segment = <div className="flex-1 h-px" style={{ background: color }} />;
  return (
    <div className="flex items-center w-full" aria-hidden="true">
      {dot}
      {Array.from({ length: stops }).map((_, i) => (
        <Fragment key={i}>
          {segment}
          <span className="w-2 h-2 rounded-full shrink-0 border" style={{ borderColor: color, background: 'transparent' }} />
        </Fragment>
      ))}
      {segment}
      <svg width="5" height="8" viewBox="0 0 5 8" fill={color}>
        <path d="M0 0L5 4L0 8z" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RouteRow — one OUTBOUND / RETURN row inside the itinerary block
// ---------------------------------------------------------------------------

interface RouteRowProps {
  route: RouteView;
  isDark: boolean;
  textPrimary: string;
  textMuted: string;
  dividerCls: string;
}

function RouteRow({ route, isDark, textPrimary, textMuted, dividerCls }: RouteRowProps) {
  const stopCls = route.stops === 0
    ? isDark ? 'text-cv-green-400' : 'text-cv-green-800'
    : textMuted;

  return (
    <div className={`border-t ${dividerCls}`}>
      {/* ── DESKTOP: one horizontal row ──────────────────────────────────── */}
      <div
        className="hidden md:grid items-center px-5 py-4 gap-5"
        style={{ gridTemplateColumns: '8rem auto 1fr auto' }}
      >
        {/* 1. Route identity */}
        <div className="min-w-0">
          <p className={`text-[10px] font-bold font-mono uppercase tracking-widest ${textPrimary}`}>
            {route.label}
          </p>
          <p className={`text-[10px] font-mono uppercase tracking-widest mt-1 truncate ${textMuted}`}>
            {route.dateLabel}
          </p>
        </div>

        {/* 2. Departure */}
        <div className="shrink-0">
          <p className={`text-3xl font-extrabold font-mono tabular-nums leading-none ${textPrimary}`}>
            {route.depTime}
          </p>
          <p className={`text-xs font-mono mt-1.5 ${textMuted}`}>
            <span className={`text-sm font-bold ${textPrimary}`}>{route.depCode}</span>
            {route.depCity && <> · {route.depCity}</>}
          </p>
        </div>

        {/* 3. Route metadata */}
        <div className="min-w-0 px-2">
          <p className={`text-[10px] font-mono text-center ${textMuted}`}>{route.duration}</p>
          <div className="my-1"><RouteLine isDark={isDark} stops={route.stops} /></div>
          <p className={`text-[10px] font-mono text-center font-bold ${stopCls}`}>{route.stopLabel}</p>
          <p className={`text-[9px] font-mono text-center mt-0.5 truncate ${textMuted}`}>
            {route.carrier}{route.flightLabel ? ` · ${route.flightLabel}` : ''}
          </p>
        </div>

        {/* 4. Arrival */}
        <div className="shrink-0 text-right">
          <p className={`text-3xl font-extrabold font-mono tabular-nums leading-none ${textPrimary}`}>
            {route.arrTime}
          </p>
          <p className={`text-xs font-mono mt-1.5 ${textMuted}`}>
            <span className={`text-sm font-bold ${textPrimary}`}>{route.arrCode}</span>
            {route.arrCity && <> · {route.arrCity}</>}
          </p>
        </div>
      </div>

      {/* ── MOBILE: label → departure → metadata → arrival ────────────────── */}
      <div className="md:hidden px-4 py-3.5">
        <div className="mb-2.5 min-w-0">
          <p className={`text-[10px] font-bold font-mono uppercase tracking-widest ${textPrimary}`}>
            {route.label} · {route.dateLabel}
          </p>
          <p className={`text-[9px] font-mono truncate ${textMuted}`}>
            {route.carrier}{route.flightLabel ? ` · ${route.flightLabel}` : ''}
          </p>
        </div>

        <div className="flex items-baseline gap-3">
          <p className={`text-2xl font-extrabold font-mono tabular-nums leading-none w-24 shrink-0 ${textPrimary}`}>
            {route.depTime}
          </p>
          <p className={`text-xs font-mono min-w-0 truncate ${textMuted}`}>
            <span className={`text-sm font-bold ${textPrimary}`}>{route.depCode}</span>
            {route.depCity && <> · {route.depCity}</>}
          </p>
        </div>

        <p className={`text-[10px] font-mono my-1.5 ${textMuted}`}>
          <span aria-hidden="true" className="inline-block w-24">↓</span>
          {route.duration} · <span className={`font-bold ${stopCls}`}>{route.stopLabel}</span>
        </p>

        <div className="flex items-baseline gap-3">
          <p className={`text-2xl font-extrabold font-mono tabular-nums leading-none w-24 shrink-0 ${textPrimary}`}>
            {route.arrTime}
          </p>
          <p className={`text-xs font-mono min-w-0 truncate ${textMuted}`}>
            <span className={`text-sm font-bold ${textPrimary}`}>{route.arrCode}</span>
            {route.arrCity && <> · {route.arrCity}</>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriceColumn — FROM cash, the winning redemption, and the Compare trigger
// ---------------------------------------------------------------------------

interface PriceColumnProps {
  totalAmount: number;
  best: OptionRowView | undefined;
  hasPoints: boolean;
  onCompare: () => void;
  isDark: boolean;
  textPrimary: string;
  textMuted: string;
  dividerCls: string;
}

function PriceColumn({ totalAmount, best, hasPoints, onCompare, isDark, textPrimary, textMuted, dividerCls }: PriceColumnProps) {
  return (
    <div className={`border-t md:border-t-0 md:border-l px-5 py-4 md:w-60 shrink-0 flex flex-col gap-3 ${dividerCls}`}>
      <div className="flex items-baseline justify-between md:block">
        <p className={`text-[10px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>From · cash</p>
        <p data-testid="from-cash" className={`text-2xl font-extrabold font-mono tabular-nums leading-none md:mt-1 ${textPrimary}`}>
          {totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
        </p>
      </div>

      {best ? (
        <div className={`rounded-lg px-3 py-2.5 ${isDark ? 'bg-gph-dark-navy border border-gph-dark-line' : 'bg-cv-navy-950'}`}>
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-cv-navy-300">Best value</p>
          <div className="flex items-baseline justify-between gap-2 mt-0.5">
            <p className="text-sm font-bold text-white leading-tight truncate">{best.displayName}</p>
            {best.cpp !== null ? (
              <p data-testid="best-value-cpp" className="text-lg font-extrabold font-mono tabular-nums text-cv-green-500 leading-none shrink-0">
                {best.cpp}<span className="text-[10px] font-bold ml-0.5">cpp</span>
              </p>
            ) : (
              <p className="text-xs font-bold font-mono text-cv-navy-300 shrink-0">check program</p>
            )}
          </div>
        </div>
      ) : (
        <p className={`text-[10px] font-mono ${textMuted}`}>
          {hasPoints ? 'No portal priced this itinerary.' : 'Select your cards to compare points pricing across portals.'}
        </p>
      )}

      {best && (
        <button
          type="button"
          onClick={onCompare}
          aria-haspopup="dialog"
          className="min-h-11 px-4 rounded-lg bg-cv-lime-500 hover:bg-cv-lime-400 text-cv-navy-950 text-sm font-extrabold whitespace-nowrap transition-colors"
        >
          Compare →
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlightCard
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FlightCard({ offer }: { offer: any }) {
  const { isDark } = useTheme();
  const [compareOpen, setCompareOpen] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(true);

  const isRoundTrip = offer.slices.length > 1;
  const totalAmount = parseFloat(offer.total_amount);

  const firstSlice = offer.slices[0];
  const firstSeg = firstSlice.segments[0];
  const lastSeg  = firstSlice.segments[firstSlice.segments.length - 1];

  const { airlineIata, airlineName: airline, ptsCtx } = getOfferFlightInfo(offer);
  const ptsResult = usePointsCalc(totalAmount, 'flight', ptsCtx);
  const best = useRankedViews(ptsResult)[0];

  const tripDates = getOfferTripDates(offer);

  const cardBg      = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const dividerCls  = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const textPrimary = isDark ? 'text-gph-dark-ink'    : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted'  : 'text-gray-500';
  const sectionBg   = isDark ? 'bg-gph-dark-bg'       : 'bg-gray-50';

  const originCode = firstSeg?.origin?.iata_code ?? '';
  const destCode   = lastSeg?.destination?.iata_code ?? '';

  const routes = buildRouteViews(offer);
  const tripWord = isRoundTrip ? 'Round trip' : 'One way';
  const scopeAdj = isRoundTrip ? 'round-trip' : 'one-way';

  const collection = offer.collection as { collection_name: string; issuer: string; perk_summary: string; source_url: string | null; limited_time_offer?: boolean } | undefined;

  const addToTrip = (
    <AddToTripButton
      type="flight"
      itemId={offer.id}
      title={`${airline} · ${originCode} → ${destCode}`}
      data={offer}
    />
  );

  return (
    <article data-testid="flight-card" className={`rounded-xl border ${cardBg}`}>
      {collection && (
        <CollectionBanner
          collectionName={collection.collection_name}
          issuer={collection.issuer}
          perkSummary={collection.perk_summary}
          sourceUrl={collection.source_url}
          limitedTimeOffer={collection.limited_time_offer}
        />
      )}

      {/* 1. Search summary — airline identity left, winning redemption right */}
      <ResultSummaryHeader
        isDark={isDark}
        roundedTop={!collection}
        eyebrow={`${tripWord.toUpperCase()} · ${totalTripDuration(offer.slices).toUpperCase()}`}
        title={airline}
        titleTestId="airline-name"
        trailing={addToTrip}
        mark={
          <div
            data-testid="airline-badge"
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-extrabold font-mono shrink-0 select-none"
            style={{ background: getAirlineColor(airlineIata) }}
          >
            {airlineIata ?? '?'}
          </div>
        }
      />

      {/* 2. Transfer-bonus notice */}
      <TransferBonusBanner
        result={ptsResult}
        tripDates={tripDates}
        rounded={false}
        scopeNote={`applies to the complete ${scopeAdj.replace('-', ' ')}`}
      />

      {/* 3. Itinerary (left) + price column (right; stacks below on phones) */}
      <div className="md:flex">
        <div className="md:flex-1 min-w-0">
          {isRoundTrip ? (
            <button
              type="button"
              onClick={() => setRoutesOpen(v => !v)}
              aria-expanded={routesOpen}
              className={`w-full min-h-11 flex items-center justify-between gap-3 px-5 py-2 text-left transition-colors ${sectionBg} ${
                isDark ? 'hover:bg-gph-dark-linesoft' : 'hover:bg-gray-100'
              }`}
            >
              <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>
                Round-trip itinerary
              </span>
              <span className={`flex items-center gap-2 text-[10px] font-mono ${textMuted}`}>
                {itineraryMeta(offer)}
                <Chevron open={routesOpen} />
              </span>
            </button>
          ) : (
            <div className={`flex items-baseline justify-between gap-3 px-5 py-2 ${sectionBg}`}>
              <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>
                Itinerary
              </span>
              <span className={`text-[10px] font-mono ${textMuted}`}>{itineraryMeta(offer)}</span>
            </div>
          )}

          {(routesOpen || !isRoundTrip) && routes.map((route, i) => (
            <RouteRow
              key={`${route.label}-${i}`}
              route={route}
              isDark={isDark}
              textPrimary={textPrimary}
              textMuted={textMuted}
              dividerCls={dividerCls}
            />
          ))}
        </div>

        <PriceColumn
          totalAmount={totalAmount}
          best={best}
          hasPoints={!!ptsResult}
          onCompare={() => setCompareOpen(true)}
          isDark={isDark}
          textPrimary={textPrimary}
          textMuted={textMuted}
          dividerCls={dividerCls}
        />
      </div>

      {compareOpen && ptsResult && (
        <CompareModal
          result={ptsResult}
          subjectType="flight"
          subjectKey={flightSubjectKey(offer)}
          baseQuote={{ cash: totalAmount, ...flightQuoteDates(offer) }}
          label={`Compare booking options — ${airline} ${originCode} to ${destCode}`}
          header={
            <>
              <p className={`text-[9.5px] font-bold font-mono tracking-widest uppercase mb-1 ${textMuted}`}>
                {tripWord} · Points vs cash
              </p>
              <h3 className={`text-lg font-extrabold leading-tight tracking-tight ${textPrimary}`}>
                {airline} · {originCode} → {destCode}
              </h3>
              <p className={`text-sm mt-1 ${textMuted}`}>
                <span className={`font-bold font-mono ${textPrimary}`}>
                  {totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                </span>{' '}cash · {routes.map(r => r.dateLabel).join(' – ')}
              </p>
            </>
          }
          scopeLabel={tripWord}
          scopeAdj={scopeAdj}
          unitNoun="options"
          showBonusNotice
          scopeNote={`applies to the complete ${scopeAdj.replace('-', ' ')}`}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </article>
  );
}
