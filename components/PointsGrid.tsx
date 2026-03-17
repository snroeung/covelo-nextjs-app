'use client';

import { useState } from 'react';
import { PointsResult, PortalResult, TransferResult } from '@/lib/points/types';
import { useTheme } from '@/contexts/ThemeContext';

function pointCurrency(portalId: string): string {
  switch (portalId) {
    case 'chase':        return 'UR pts';
    case 'amex':         return 'MR pts';
    case 'capital_one':  return 'miles';
    case 'bilt':         return 'pts';
    case 'citi':         return 'TY pts';
    default:             return 'pts';
  }
}

function fmtPoints(n: number, portalId: string): string {
  return `${n.toLocaleString()} ${pointCurrency(portalId)}`;
}

function fmtEarn(n: number, portalId: string): string {
  return `+${n.toLocaleString()} ${pointCurrency(portalId)}`;
}

function fmtTransferPoints(n: number): string {
  return `${n.toLocaleString()} pts`;
}

// ---------------------------------------------------------------------------
// PortalRow
// ---------------------------------------------------------------------------

function PortalRow({ result, isBest }: { result: PortalResult; isBest: boolean }) {
  const { isDark } = useTheme();
  const rowBorder = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const nameCls   = isBest
    ? 'text-cv-blue-400'
    : isDark ? 'text-white/80' : 'text-cv-blue-950';
  const redeemCls = isBest
    ? 'text-cv-green-400'
    : isDark ? 'text-white/60' : 'text-cv-blue-900/60';
  const earnCls   = isDark ? 'text-cv-amber-400' : 'text-cv-amber-600';
  const labelCls  = isDark ? 'text-cv-blue-500' : 'text-cv-blue-400';

  return (
    <div className={`px-5 py-3 border-b ${rowBorder} last:border-0`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-1.5">
        <span className={`text-sm font-medium ${nameCls}`}>{result.cardName}</span>
        {isBest && (
          <span className="px-2 py-0.5 rounded-full bg-cv-green-700 text-cv-green-100 text-[10px] font-semibold uppercase tracking-wide">
            Best value
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs">
        <div>
          <span className={`${labelCls} mr-1`}>Redeem</span>
          <span className={`font-semibold tabular-nums ${redeemCls}`}>
            {fmtPoints(result.pointsNeeded, result.portalId)}
          </span>
        </div>
        <div className={`w-px h-3 ${isDark ? 'bg-cv-blue-800' : 'bg-cv-blue-200'}`} />
        <div>
          <span className={`${labelCls} mr-1`}>Pay cash & earn</span>
          <span className={`font-semibold tabular-nums ${earnCls}`}>
            {fmtEarn(result.pointsEarned, result.portalId)}
          </span>
          <span className={`ml-1 ${labelCls}`}>({result.earnRate}x)</span>
        </div>
      </div>
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

export function PointsGrid({ result, collapseAfter }: { result: PointsResult; collapseAfter?: number }) {
  const { isDark } = useTheme();
  const [hackExpanded, setHackExpanded] = useState(false);
  const [rowsExpanded, setRowsExpanded] = useState(false);

  const betterTransfers = result.transferAlternatives.filter((t) => t.isBetterThanPortal);
  const hasHack = betterTransfers.length > 0;

  const limit      = collapseAfter ?? result.portalResults.length;
  const visible    = rowsExpanded ? result.portalResults : result.portalResults.slice(0, limit);
  const hiddenRows = result.portalResults.length - limit;

  const containerBg  = isDark ? 'bg-cv-blue-900' : 'bg-white border border-cv-blue-100';
  const moreButtonBg = isDark ? 'bg-cv-blue-950 text-cv-blue-400' : 'bg-cv-blue-50 text-cv-blue-600';
  const hackHeaderBg = isDark ? 'bg-cv-blue-950 hover:bg-cv-blue-900' : 'bg-cv-amber-50 hover:bg-cv-amber-100';
  const hackBorder   = isDark ? 'border-cv-amber-900' : 'border-cv-amber-200';

  return (
    <div className={`rounded-xl overflow-hidden ${containerBg}`}>

      {visible.map((r, i) => (
        <PortalRow key={r.portalId} result={r} isBest={i === 0} />
      ))}

      {hiddenRows > 0 && (
        <button
          onClick={() => setRowsExpanded((v) => !v)}
          className={`w-full px-5 py-2.5 text-xs font-medium text-center ${moreButtonBg}`}
        >
          {rowsExpanded ? 'Show less' : `+${hiddenRows} more option${hiddenRows > 1 ? 's' : ''}`}
        </button>
      )}

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

      {/* Disclaimer */}
      <p className={`px-5 py-2.5 text-[10px] leading-relaxed border-t ${isDark ? 'border-cv-blue-900 text-cv-blue-500' : 'border-cv-blue-100 text-cv-blue-400'}`}>
        Estimates based on market rates — actual portal prices may differ. Point currencies are not interchangeable (UR ≠ MR ≠ miles).
      </p>
    </div>
  );
}
