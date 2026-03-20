'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { PointsGrid } from '@/components/PointsGrid';
import { classifyRoute } from '@/lib/points/transferPartners';
import { Cabin, FlightContext } from '@/lib/points/types';

// Converts ISO 8601 duration "PT3H45M" → "3h 45m"
function formatDuration(iso: string): string {
  const h = iso.match(/(\d+)H/)?.[1];
  const m = iso.match(/(\d+)M/)?.[1];
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || iso;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isoToMinutes(iso: string): number {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  return h * 60 + m;
}

function totalTripDuration(slices: any[]): string {
  const mins = slices.reduce((sum, s) => sum + isoToMinutes(s.duration), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

function layoverMinutes(arrIso: string, depIso: string): number {
  return Math.round((new Date(depIso).getTime() - new Date(arrIso).getTime()) / 60000);
}

function formatLayover(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SliceRow({ slice }: { slice: any }) {
  const segments = slice.segments;

  return (
    <div className="space-y-1.5">
      {segments.map((seg: any, i: number) => (
        <div key={i}>
          <div className="flex items-center gap-2 text-xs text-cv-blue-400/80">
            <span className="font-mono">{seg.origin.iata_code}</span>
            <span>{formatTime(seg.departing_at)}</span>
            <span className="flex-1 border-t border-dashed border-cv-blue-400/20" />
            <span>{formatDuration(seg.duration)}</span>
            <span className="flex-1 border-t border-dashed border-cv-blue-400/20" />
            <span>{formatTime(seg.arriving_at)}</span>
            <span className="font-mono">{seg.destination.iata_code}</span>
          </div>
          {i < segments.length - 1 && (
            <div className="py-1 pl-6">
              <span className="text-[10px] text-cv-amber-400">
                {formatLayover(layoverMinutes(seg.arriving_at, segments[i + 1].departing_at))} layover · {seg.destination.iata_code}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FlightCard({ offer, defaultCollapsed = false }: { offer: any; defaultCollapsed?: boolean }) {
  const { isDark } = useTheme();
  const cardBg      = isDark ? 'bg-cv-blue-900' : 'bg-white border border-cv-blue-100';
  const divider     = isDark ? 'border-cv-blue-800' : 'border-cv-blue-100';
  const textPrimary = isDark ? 'text-white' : 'text-cv-blue-950';
  const textMuted   = isDark ? 'text-cv-blue-400' : 'text-cv-blue-400';

  const firstSegment = offer.slices[0].segments[0];
  const lastSlice    = offer.slices[offer.slices.length - 1];
  const lastSegment  = lastSlice.segments[lastSlice.segments.length - 1];
  const airline      = offer.owner?.name ?? firstSegment?.marketing_carrier?.name ?? 'Unknown airline';
  const isRoundTrip  = offer.slices.length > 1;
  const departDate   = formatDate(offer.slices[0].segments[0].departing_at);
  const returnDate   = isRoundTrip ? formatDate(offer.slices[1].segments[0].departing_at) : null;
  const maxStops     = Math.max(...offer.slices.map((s: any) => s.segments.length - 1)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const stopsLabel   = maxStops === 0 ? 'Nonstop' : `${maxStops} stop${maxStops > 1 ? 's' : ''}`;

  // Build flight context for transfer/award calculations
  const airlineIata  = (offer.owner?.iata_code ?? firstSegment?.marketing_carrier?.iata_code ?? null) as string | null;
  const originIata   = (firstSegment?.origin?.iata_code ?? null) as string | null;
  const destIata     = (lastSegment?.destination?.iata_code ?? null) as string | null;
  const rawCabin     = firstSegment?.passengers?.[0]?.cabin_class as string | undefined;
  const cabin: Cabin = rawCabin === 'business' ? 'business' : rawCabin === 'first' ? 'first' : 'economy';
  const flightCtx: FlightContext = {
    airlineIata,
    originIata,
    destIata,
    routeType: classifyRoute(originIata, destIata),
    cabin,
  };

  // Points per leg — split total evenly across slices
  const totalAmount  = parseFloat(offer.total_amount);
  const perLegPrice  = totalAmount / offer.slices.length;
  // Always call both hooks unconditionally; one will be used based on isRoundTrip
  const oneWayPoints = usePointsCalc(isRoundTrip ? 0 : totalAmount, 'flight', flightCtx);
  const perLegPoints = usePointsCalc(isRoundTrip ? perLegPrice : 0, 'flight', flightCtx);

  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`rounded-xl overflow-hidden ${cardBg}`}>
      {/* Header — click to collapse/expand */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-3 text-left ${collapsed ? '' : `border-b ${divider}`}`}
      >
        <div>
          <p className={`text-sm font-semibold ${textPrimary}`}>{airline}</p>
          <p className={`text-xs ${textMuted}`}>
            {departDate}{returnDate ? ` → ${returnDate}` : ''} · {isRoundTrip ? 'Round trip' : 'One way'} · {totalTripDuration(offer.slices)} · {stopsLabel}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right">
            <p className={`text-[10px] ${textMuted}`}>starting from</p>
            <p className="text-lg font-bold text-cv-blue-400">
              {totalAmount.toLocaleString('en-US', {
                style: 'currency',
                currency: offer.total_currency,
                maximumFractionDigits: 0,
              })}
            </p>
            <p className={`text-xs ${textMuted}`}>per person</p>
          </div>
          <svg
            className={`w-4 h-4 mt-1 shrink-0 transition-transform text-cv-blue-400 ${collapsed ? '-rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Slices + per-leg points */}
      {!collapsed && (
        <div className="px-5 py-4 space-y-5">
          {offer.slices.map((slice: any, i: number) => {
            const label = isRoundTrip ? (i === 0 ? 'Outbound' : 'Return') : null;
            const pts   = isRoundTrip ? perLegPoints : oneWayPoints;
            return (
              <div key={i} className="space-y-3">
                {label && (
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>{label}</p>
                )}
                <SliceRow slice={slice} />
                {pts && (
                  <div className="pt-1">
                    <PointsGrid result={pts} collapseAfter={1} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
