'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { PointsGrid } from '@/components/PointsGrid';
import { AddToTripButton } from '@/components/AddToTripButton';
import { BestPortalPanel } from '@/components/BestPortalPanel';
import { classifyRoute } from '@/lib/points/transferPartners';
import { Cabin, FlightContext } from '@/lib/points/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(iso: string): string {
  const h = iso.match(/(\d+)H/)?.[1];
  const m = iso.match(/(\d+)M/)?.[1];
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || iso;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isoToMinutes(iso: string): number {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  return h * 60 + m;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function totalTripDuration(slices: any[]): string {
  const mins = slices.reduce((sum, s) => sum + isoToMinutes(s.duration), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCabin(seg: any): Cabin {
  const raw = seg?.passengers?.[0]?.cabin_class as string | undefined;
  return raw === 'business' ? 'business' : raw === 'first' ? 'first' : 'economy';
}

const AIRLINE_COLORS: Record<string, string> = {
  AA: '#c0212b', DL: '#003c7d', UA: '#172649', B6: '#0075ff',
  WN: '#ff4500', AS: '#0074c8', NK: '#ffd300', F9: '#00a651',
  HA: '#7b1fa2', QR: '#5c0716', EK: '#c8102e', LH: '#05164d',
  BA: '#075aaa', AC: '#c0202d', AF: '#002157', KL: '#00a1de',
  SQ: '#0032a0', CX: '#006564', JL: '#e11931', NH: '#003087',
};

function getAirlineColor(iata: string | null): string {
  return (iata && AIRLINE_COLORS[iata]) ?? '#374151';
}

function ArrowLine({ isDark }: { isDark: boolean }) {
  const color = isDark ? '#262629' : '#d1d5db';
  return (
    <div className="flex items-center w-full">
      <div className="flex-1 h-px" style={{ background: color }} />
      <svg width="5" height="8" viewBox="0 0 5 8" fill={color}>
        <path d="M0 0L5 4L0 8z" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LegRow — pure layout, no hooks, no actions
// ---------------------------------------------------------------------------

interface LegRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slice: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offer: any;
  isDark: boolean;
  showCash: boolean;
  textPrimary: string;
  textMuted: string;
}

function LegRow({ slice, offer, isDark, showCash, textPrimary, textMuted }: LegRowProps) {
  const firstSeg   = slice.segments[0];
  const lastSeg    = slice.segments[slice.segments.length - 1];
  const stops      = slice.segments.length - 1;
  const airline    = offer.owner?.name ?? firstSeg?.marketing_carrier?.name ?? 'Unknown airline';
  const airlineIata = (offer.owner?.iata_code ?? firstSeg?.marketing_carrier?.iata_code ?? null) as string | null;
  const flightNum  = (firstSeg?.marketing_carrier_flight_number ?? '') as string;
  const flightLabel = [airlineIata, flightNum].filter(Boolean).join(' ');
  const airColor   = getAirlineColor(airlineIata);
  const depTime    = formatTime(firstSeg.departing_at);
  const arrTime    = formatTime(lastSeg.arriving_at);
  const dur        = formatDuration(slice.duration);
  const originCode = firstSeg.origin.iata_code as string;
  const destCode   = lastSeg.destination.iata_code as string;
  const totalAmount = parseFloat(offer.total_amount);

  // grid: badge | content | [cash]
  const colTemplate = showCash ? '36px 1fr 115px' : '36px 1fr';

  return (
    <div data-testid="flight-card">
      {/* ── DESKTOP ─────────────────────────────────────────────────────── */}
      <div
        className="hidden md:grid items-center px-5 py-4 gap-5"
        style={{ gridTemplateColumns: colTemplate }}
      >
        {/* 1. Airline badge */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-extrabold font-mono shrink-0 select-none"
          style={{ background: airColor }}
        >
          {airlineIata ?? '?'}
        </div>

        {/* 2. Airline label above + dep → arrow → arr inline */}
        <div className="min-w-0">
          <div className={`text-[9px] font-bold font-mono uppercase tracking-widest truncate ${textMuted}`}>
            {airline}{flightLabel ? ` · ${flightLabel}` : ''}
          </div>
          <div className="flex items-center gap-5 mt-1.5">
            {/* Dep */}
            <div className="shrink-0">
              <div className={`text-3xl font-extrabold font-mono tabular-nums leading-none ${textPrimary}`}>
                {depTime}
              </div>
              <div className={`text-sm font-bold font-mono mt-1 ${textMuted}`}>{originCode}</div>
            </div>
            {/* Arrow + duration + stops */}
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <div className={`text-[9px] font-mono text-center ${textMuted}`}>{dur}</div>
              <ArrowLine isDark={isDark} />
              <div className={`text-[9px] font-mono text-center font-bold ${
                stops === 0 ? 'text-green-600' : textMuted
              }`}>
                {stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`}
              </div>
            </div>
            {/* Arr */}
            <div className="shrink-0 text-right">
              <div className={`text-3xl font-extrabold font-mono tabular-nums leading-none ${textPrimary}`}>
                {arrTime}
              </div>
              <div className={`text-sm font-bold font-mono mt-1 ${textMuted}`}>{destCode}</div>
            </div>
          </div>
        </div>

        {/* 3. Cash (one-way only) */}
        {showCash && (
          <div className="text-right shrink-0">
            <div className={`text-[9px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>Cash</div>
            <div className={`text-2xl font-extrabold font-mono tabular-nums leading-none mt-0.5 ${textPrimary}`}>
              {totalAmount.toLocaleString('en-US', {
                style: 'currency', currency: offer.total_currency, maximumFractionDigits: 0,
              })}
            </div>
            <div className={`text-[10px] font-mono mt-0.5 ${textMuted}`}>per person</div>
          </div>
        )}
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────── */}
      <div className="md:hidden px-4 py-3 space-y-2.5">
        {/* Badge + airline label + [cash] */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[10px] font-extrabold font-mono shrink-0"
            style={{ background: airColor }}
          >
            {airlineIata ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[9px] font-bold font-mono uppercase tracking-widest truncate ${textMuted}`}>
              {airline}{flightLabel ? ` · ${flightLabel}` : ''}
            </div>
          </div>
          {showCash && (
            <div className="shrink-0 text-right">
              <div className={`text-lg font-extrabold font-mono tabular-nums leading-none ${textPrimary}`}>
                {totalAmount.toLocaleString('en-US', {
                  style: 'currency', currency: offer.total_currency, maximumFractionDigits: 0,
                })}
              </div>
              <div className={`text-[9px] font-mono ${textMuted}`}>per person</div>
            </div>
          )}
        </div>

        {/* Dep → arr timeline */}
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <div className={`text-xl font-extrabold font-mono tabular-nums leading-none ${textPrimary}`}>{depTime}</div>
            <div className={`text-[10px] font-mono mt-0.5 ${textMuted}`}>{originCode}</div>
          </div>
          <div className="flex-1 flex flex-col items-stretch">
            <div className={`text-[9px] font-mono text-center ${textMuted}`}>{dur}</div>
            <ArrowLine isDark={isDark} />
            <div className={`text-[9px] font-mono text-center font-bold ${
              stops === 0 ? 'text-green-600' : textMuted
            }`}>
              {stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-xl font-extrabold font-mono tabular-nums leading-none ${textPrimary}`}>{arrTime}</div>
            <div className={`text-[10px] font-mono mt-0.5 ${textMuted}`}>{destCode}</div>
          </div>
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
  const { isDark }   = useTheme();
  const [expanded, setExpanded] = useState(false);

  const isRoundTrip = offer.slices.length > 1;
  const totalAmount = parseFloat(offer.total_amount);

  const leg0Slice = offer.slices[0];
  const leg0First = leg0Slice.segments[0];
  const leg0Last  = leg0Slice.segments[leg0Slice.segments.length - 1];

  const leg1Slice = offer.slices[1] ?? offer.slices[0];
  const leg1First = leg1Slice.segments[0];

  const airlineIata = (offer.owner?.iata_code ?? leg0First?.marketing_carrier?.iata_code ?? null) as string | null;

  const ptsCtx: FlightContext = {
    airlineIata,
    originIata: leg0First?.origin?.iata_code ?? null,
    destIata:   leg0Last?.destination?.iata_code ?? null,
    routeType:  classifyRoute(leg0First?.origin?.iata_code, leg0Last?.destination?.iata_code),
    cabin:      getCabin(leg0First),
  };
  const ptsResult  = usePointsCalc(totalAmount, 'flight', ptsCtx);
  const nPortals   = ptsResult?.portalGroups.length ?? 0;

  const cardBg      = isDark ? 'bg-gph-dark-card' : 'bg-white border border-gray-200';
  const divider     = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const textPrimary = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const sectionBg   = isDark ? 'bg-gph-dark-bg'      : 'bg-gray-50';

  const airline    = offer.owner?.name ?? leg0First?.marketing_carrier?.name ?? 'Unknown airline';
  const originCode = leg0First?.origin?.iata_code ?? '';
  const destCode   = leg0Last?.destination?.iata_code ?? '';

  const legProps = { offer, isDark, textPrimary, textMuted };

  const addToTrip = (
    <div onClick={e => e.stopPropagation()}>
      <AddToTripButton
        type="flight"
        itemId={offer.id}
        title={`${airline} · ${originCode} → ${destCode}`}
        data={offer}
      />
    </div>
  );

  // ── ONE-WAY ────────────────────────────────────────────────────────────
  if (!isRoundTrip) {
    return (
      <div className={`rounded-xl overflow-hidden ${cardBg}`}>
        <LegRow {...legProps} slice={leg0Slice} showCash />

        {/* Dark navy portal bar */}
        {ptsResult ? (
          <BestPortalPanel
            result={ptsResult}
            isDark={isDark}
            variant="bar"
            compareLabel={expanded ? '↑ Hide' : `Compare ${nPortals} portal${nPortals !== 1 ? 's' : ''} →`}
            onCompareClick={() => setExpanded(v => !v)}
            trailingSlot={addToTrip}
          />
        ) : (
          /* Fallback footer when no points data */
          <div className={`px-5 py-2.5 border-t ${divider} flex items-center justify-end`}>
            {addToTrip}
          </div>
        )}

        {/* PointsGrid */}
        {expanded && ptsResult && (
          <div className={`border-t ${divider}`}>
            <PointsGrid result={ptsResult} />
          </div>
        )}
      </div>
    );
  }

  // ── ROUND-TRIP ─────────────────────────────────────────────────────────
  const totalDur = totalTripDuration([leg0Slice, leg1Slice]);

  return (
    <div className={`rounded-xl overflow-hidden ${cardBg}`}>

      {/* Trip header */}
      <div className={`px-5 py-2 border-b ${divider} ${sectionBg}`}>
        <span className={`text-[9px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>
          Round trip · {totalDur} total · {offer.slices.length} leg{offer.slices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Outbound section */}
      <div className={`px-5 py-2 border-b ${divider} ${sectionBg}`}>
        <span className={`text-[9px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>
          Outbound · {formatDate(leg0First.departing_at)} · {totalTripDuration([leg0Slice])}
        </span>
      </div>
      <LegRow {...legProps} slice={leg0Slice} showCash={false} />

      {/* Return section */}
      <div className={`px-5 py-2 border-t border-b ${divider} ${sectionBg}`}>
        <span className={`text-[9px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>
          Return · {formatDate(leg1First.departing_at)} · {totalTripDuration([leg1Slice])}
        </span>
      </div>
      <LegRow {...legProps} slice={leg1Slice} showCash={false} />

      {/* Dark navy portal bar with total cash */}
      {ptsResult ? (
        <BestPortalPanel
          result={ptsResult}
          isDark={isDark}
          variant="bar"
          compareLabel={expanded ? '↑ Hide' : `Compare ${nPortals} portal${nPortals !== 1 ? 's' : ''} →`}
          onCompareClick={() => setExpanded(v => !v)}
          trailingSlot={addToTrip}
          leadingSlot={
            <div>
              <p className="text-[9px] font-bold font-mono tracking-widest uppercase text-cv-navy-400 mb-0.5">Total Cash</p>
              <p className="text-xl font-extrabold font-mono tabular-nums text-white leading-tight">
                {totalAmount.toLocaleString('en-US', {
                  style: 'currency', currency: offer.total_currency, maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-[10px] font-mono text-cv-navy-400">per person · round trip</p>
            </div>
          }
        />
      ) : (
        /* Fallback footer when no points data */
        <div className={`px-5 py-3 border-t ${divider} ${sectionBg} flex items-center justify-between gap-4`}>
          <div>
            <div className={`text-[9px] font-bold font-mono uppercase tracking-widest ${textMuted}`}>Total cash</div>
            <div className={`text-xl font-extrabold font-mono tabular-nums leading-none mt-0.5 ${textPrimary}`}>
              {totalAmount.toLocaleString('en-US', {
                style: 'currency', currency: offer.total_currency, maximumFractionDigits: 0,
              })}
            </div>
            <div className={`text-[10px] font-mono mt-0.5 ${textMuted}`}>per person · round trip</div>
          </div>
          {addToTrip}
        </div>
      )}

      {/* PointsGrid */}
      {expanded && ptsResult && (
        <div className={`border-t ${divider}`}>
          <PointsGrid result={ptsResult} />
        </div>
      )}
    </div>
  );
}
