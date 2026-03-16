'use client';

import { useState } from 'react';
import { PointsResult, PortalResult, TransferResult } from '@/lib/points/types';
import { useTheme } from '@/contexts/ThemeContext';

function pointUnit(portalId: string): 'pts' | 'mi' {
  return portalId === 'capital_one' ? 'mi' : 'pts';
}

function fmtPoints(n: number, portalId: string): string {
  return `${n.toLocaleString()} ${pointUnit(portalId)} ~est.`;
}

function fmtTransferPoints(n: number): string {
  return `${n.toLocaleString()} pts ~est.`;
}

// ---------------------------------------------------------------------------
// PortalRow
// ---------------------------------------------------------------------------

function PortalRow({ result, isBest }: { result: PortalResult; isBest: boolean }) {
  const { isDark } = useTheme();
  const rowBorder  = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const nameCls    = isBest
    ? 'text-cv-blue-400'
    : isDark ? 'text-white/80' : 'text-cv-blue-950';
  const pointsCls  = isBest
    ? 'text-cv-green-400'
    : isDark ? 'text-white/60' : 'text-cv-blue-900/60';

  return (
    <div className={`flex items-center justify-between px-5 py-3.5 border-b ${rowBorder} last:border-0`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className={`text-sm font-medium ${nameCls}`}>{result.cardName}</span>
        {isBest && (
          <span className="px-2 py-0.5 rounded-full bg-cv-green-700 text-cv-green-100 text-[10px] font-semibold uppercase tracking-wide">
            Best value
          </span>
        )}
      </div>
      <span className={`ml-4 shrink-0 text-sm font-semibold tabular-nums ${pointsCls}`}>
        {fmtPoints(result.pointsNeeded, result.portalId)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransferRow
// ---------------------------------------------------------------------------

function TransferRow({ transfer }: { transfer: TransferResult }) {
  const { isDark } = useTheme();
  const rowBorder = isDark ? 'border-cv-blue-900' : 'border-cv-amber-200';

  return (
    <div className={`flex items-center justify-between px-5 py-3.5 border-b ${rowBorder} last:border-0`}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cv-amber-400 shrink-0" />
        <span className="text-sm font-medium text-cv-amber-400">
          Transfer · {transfer.partnerProgram}
        </span>
        <span className="text-xs text-cv-amber-600">{transfer.transferRatio}</span>
      </div>
      <span className="ml-4 shrink-0 text-sm font-semibold tabular-nums text-cv-amber-400">
        {transfer.estimatedPointsNeeded !== null
          ? fmtTransferPoints(transfer.estimatedPointsNeeded)
          : 'Award chart pricing'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PointsGrid
// ---------------------------------------------------------------------------

export function PointsGrid({ result }: { result: PointsResult }) {
  const { isDark } = useTheme();
  const [hackExpanded, setHackExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const betterTransfers = result.transferAlternatives.filter((t) => t.isBetterThanPortal);
  const hasHack   = betterTransfers.length > 0;
  const extraCount = result.portalResults.length - 1;

  const containerBg      = isDark ? 'bg-cv-blue-900' : 'bg-white border border-cv-blue-100';
  const moreButtonBg     = isDark ? 'bg-cv-blue-950 text-cv-blue-400' : 'bg-cv-blue-50 text-cv-blue-600';
  const hackHeaderBg     = isDark ? 'bg-cv-blue-950 hover:bg-cv-blue-900' : 'bg-cv-amber-50 hover:bg-cv-amber-100';
  const hackBorder       = isDark ? 'border-cv-amber-900' : 'border-cv-amber-200';

  return (
    <div className={`rounded-xl overflow-hidden ${containerBg}`}>

      {/* Mobile */}
      <div className="md:hidden">
        {(mobileExpanded ? result.portalResults : result.portalResults.slice(0, 1)).map((r, i) => (
          <PortalRow key={r.portalId} result={r} isBest={i === 0} />
        ))}
        {extraCount > 0 && (
          <button
            onClick={() => setMobileExpanded((v) => !v)}
            className={`w-full px-5 py-2.5 text-xs font-medium text-center ${moreButtonBg}`}
          >
            {mobileExpanded ? 'Show less' : `+${extraCount} more option${extraCount > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        {result.portalResults.map((r, i) => (
          <PortalRow key={r.portalId} result={r} isBest={i === 0} />
        ))}
      </div>

      {/* Transfer hack */}
      {hasHack && (
        <div className={`border-t ${hackBorder}`}>
          <button
            onClick={() => setHackExpanded((v) => !v)}
            className={`w-full flex items-center justify-between px-5 py-3 transition-colors text-left ${hackHeaderBg}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cv-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-cv-amber-400 uppercase tracking-wide">
                Transfer beats portal
              </span>
            </div>
            <span className="text-cv-amber-600 text-xs ml-2">{hackExpanded ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {hackExpanded &&
            betterTransfers.map((t, i) => (
              <TransferRow key={`${t.sourcePortalId}-${t.partnerProgram}-${i}`} transfer={t} />
            ))}
        </div>
      )}
    </div>
  );
}
