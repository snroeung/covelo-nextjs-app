'use client';

import type { ReactNode } from 'react';
import type { PointsResult } from '@/lib/points/types';
import { PORTAL_ABBR, PORTAL_NAMES } from '@/lib/points/types';
import { getBestOption } from '@/lib/points/rankOptions';

interface BestPortalPanelProps {
  result: PointsResult | null;
  isDark: boolean;
  /** stacked = hotel room card footer, bar = flight card footer */
  variant: 'stacked' | 'bar';
  onCompareClick: () => void;
  compareLabel: string;
  /** Hotel's "Reserve →" button; flight omits */
  primaryCta?: { label: string; onClick?: () => void };
  /** Flight round-trip's "Total Cash" column */
  leadingSlot?: ReactNode;
  /** Flight's AddToTripButton */
  trailingSlot?: ReactNode;
}

const UpArrowIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} fill="none">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export function BestPortalPanel({
  result, isDark, variant, onCompareClick, compareLabel, primaryCta, leadingSlot, trailingSlot,
}: BestPortalPanelProps) {
  const best = getBestOption(result);
  if (!best) return null;

  const name = best.kind === 'portal' ? best.group.portalName : best.transfer.partnerProgram;
  const pointsNeeded = best.kind === 'portal'
    ? best.group.results[0].pointsNeeded
    : best.transfer.estimatedPointsNeeded;
  const cpp = best.kind === 'portal' ? best.group.results[0].centsPerPoint : best.transfer.transferCpp;
  const abbr = best.kind === 'portal' ? (PORTAL_ABBR[best.group.portalId] ?? 'pts') : 'pts';
  const isBestValue = (cpp ?? 0) > 1.0;
  const transferTag = best.kind === 'transfer'
    ? `⇄ Transfer via ${PORTAL_NAMES[best.transfer.sourcePortalId]}`
    : null;

  const pointsLabel = pointsNeeded !== null
    ? `${pointsNeeded.toLocaleString()} ${abbr}${cpp !== null ? ` · ${cpp}¢/pt` : ''}`
    : 'check program';

  if (variant === 'stacked') {
    return (
      <div className="bg-cv-navy-950 px-4 pt-3.5 pb-4 mt-auto">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[8.5px] font-bold font-mono tracking-widest text-cv-navy-400 uppercase truncate pr-2">
            {name}
          </p>
          {transferTag ? (
            <span className="text-[8.5px] font-extrabold font-mono text-blue-400 uppercase shrink-0">
              {transferTag}
            </span>
          ) : isBestValue && (
            <span className="text-[8.5px] font-extrabold font-mono text-cv-green-500 uppercase shrink-0 flex items-center gap-0.5">
              <UpArrowIcon />
              Above face
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 mb-3">
          {pointsNeeded !== null ? (
            <>
              <span className="font-mono text-lg font-extrabold text-lime-400 leading-none">
                {pointsNeeded.toLocaleString()}
              </span>
              <span className="text-xs text-cv-navy-300">{abbr}{cpp !== null && ` · ${cpp}¢/pt`}</span>
            </>
          ) : (
            <span className="text-xs text-cv-navy-300 italic">check program for pricing</span>
          )}
        </div>
        {primaryCta && (
          <button
            onClick={primaryCta.onClick}
            className="w-full bg-lime-500 hover:bg-lime-400 text-cv-navy-950 font-extrabold text-xs py-2.5 rounded-lg transition-colors"
          >
            {primaryCta.label}
          </button>
        )}
        <button
          onClick={onCompareClick}
          className="w-full mt-1.5 bg-transparent text-white border border-white/20 hover:border-white/40 font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          {compareLabel}
          <ChevronIcon />
        </button>
      </div>
    );
  }

  // variant === 'bar'
  const navyBar = isDark ? 'bg-cv-navy-900' : 'bg-cv-navy-950';

  return (
    <div className={`flex flex-wrap items-center gap-4 md:gap-6 px-5 py-3.5 ${navyBar}`}>
      {leadingSlot}

      <div>
        <p className="text-[9px] font-bold font-mono tracking-widest uppercase text-cv-navy-400 mb-0.5">
          {best.kind === 'portal' ? 'Best Portal' : 'Best Value'}
        </p>
        <p className="text-sm font-bold text-white leading-tight">{name}</p>
        {transferTag && (
          <p className="text-[9px] font-bold font-mono text-blue-400">{transferTag}</p>
        )}
      </div>

      <div>
        <p className="text-[9px] font-bold font-mono tracking-widest uppercase text-cv-navy-400 mb-0.5">Redeem</p>
        <p className="text-sm font-bold font-mono text-cv-sky-400 leading-tight">{pointsLabel}</p>
      </div>

      <div className="hidden md:block">
        <p className="text-[9px] font-bold font-mono tracking-widest uppercase text-cv-navy-400 mb-0.5">Value</p>
        <p className={`text-sm font-bold flex items-center gap-1 ${isBestValue ? 'text-cv-green-500' : 'text-cv-navy-300'}`}>
          {isBestValue && <UpArrowIcon />}
          {isBestValue ? 'Above Face' : 'At Face'}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onCompareClick}
          className="bg-lime-500 text-cv-blue-950 font-extrabold text-xs px-3.5 py-2 rounded-lg whitespace-nowrap hover:bg-lime-400 transition-colors"
        >
          {compareLabel}
        </button>
        {trailingSlot}
      </div>
    </div>
  );
}
