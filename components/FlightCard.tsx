'use client';

import { Fragment, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { CollectionBanner } from '@/components/CollectionBanner';
import { TransferBonusBanner } from '@/components/TransferBonusBanner';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { RedemptionTable } from '@/components/RedemptionTable';
import { AddToTripButton } from '@/components/AddToTripButton';
import { ResultSummaryHeader } from '@/components/ResultSummaryHeader';
import { BestRedemptionBar } from '@/components/BestRedemptionBar';
import { buildRouteViews, getOfferFlightInfo, itineraryMeta, totalTripDuration, type RouteView } from '@/lib/flights/itinerary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AIRLINE_COLORS: Record<string, string> = {
  AA: '#c0212b', DL: '#003c7d', UA: '#172649', B6: '#0075ff',
  WN: '#ff4500', AS: '#0074c8', NK: '#ffd300', F9: '#007a3d',
  HA: '#7b1fa2', QR: '#5c0716', EK: '#c8102e', LH: '#05164d',
  BA: '#075aaa', AC: '#c0202d', AF: '#002157', KL: '#00a1de',
  SQ: '#0032a0', CX: '#006564', JL: '#e11931', NH: '#003087',
};

function getAirlineColor(iata: string | null): string {
  return (iata && AIRLINE_COLORS[iata]) ?? '#374151';
}

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
// FlightCard
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FlightCard({ offer }: { offer: any }) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(true);

  const isRoundTrip = offer.slices.length > 1;
  const totalAmount = parseFloat(offer.total_amount);

  const firstSlice = offer.slices[0];
  const firstSeg = firstSlice.segments[0];
  const lastSeg  = firstSlice.segments[firstSlice.segments.length - 1];

  const { airlineIata, airlineName: airline, ptsCtx } = getOfferFlightInfo(offer);
  const ptsResult = usePointsCalc(totalAmount, 'flight', ptsCtx);

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
        rounded={false}
        scopeNote={`applies to the complete ${scopeAdj.replace('-', ' ')}`}
      />

      {/* 3. Itinerary block — collapsible once there's more than one route */}
      <div>
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

      {/* 4. Compare panel + the portal comparison it expands */}
      {ptsResult ? (
        <>
          <BestRedemptionBar
            result={ptsResult}
            expanded={expanded}
            onToggle={() => setExpanded(v => !v)}
            roundedBottom={!expanded}
            showMetrics
            isDark={isDark}
          />
          {expanded && (
            <RedemptionTable
              result={ptsResult}
              scopeLabel={tripWord}
              scopeAdj={scopeAdj}
              unitNoun="options"
              showBonusNotice={false}
            />
          )}
        </>
      ) : (
        <p className={`border-t px-5 py-3 text-[10px] font-mono rounded-b-xl ${dividerCls} ${sectionBg} ${textMuted}`}>
          Select your cards to compare points pricing across portals.
        </p>
      )}
    </article>
  );
}
