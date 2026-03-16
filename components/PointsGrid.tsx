'use client';

import { useState } from 'react';
import { PointsResult, PortalResult, TransferResult } from '@/lib/points/types';

// Capital One earns miles; everything else earns points
function pointUnit(portalId: string): 'pts' | 'mi' {
  return portalId === 'capital_one' ? 'mi' : 'pts';
}

// All points figures MUST include ~est. — no exceptions
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
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${
        isBest ? 'bg-green-50' : 'bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-gray-800">{result.portalName}</span>
        <span className="text-xs text-gray-400">{result.cardName}</span>
        {isBest && (
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            Best value
          </span>
        )}
      </div>
      <span className="ml-4 shrink-0 text-sm font-semibold tabular-nums text-gray-900">
        {fmtPoints(result.pointsNeeded, result.portalId)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransferRow
// ---------------------------------------------------------------------------

function TransferRow({ transfer }: { transfer: TransferResult }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100 last:border-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-gray-800">{transfer.partnerProgram}</span>
        <span className="text-xs text-gray-500">
          via {transfer.sourcePortalId.replace('_', ' ')} · {transfer.transferRatio}
        </span>
      </div>
      <span className="ml-4 shrink-0 text-sm font-semibold tabular-nums text-amber-800">
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
  const [hackExpanded, setHackExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const betterTransfers = result.transferAlternatives.filter((t) => t.isBetterThanPortal);
  const hasHack = betterTransfers.length > 0;

  const extraCount = result.portalResults.length - 1;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">

      {/* Mobile — collapsed to best row by default */}
      <div className="md:hidden">
        {(mobileExpanded ? result.portalResults : result.portalResults.slice(0, 1)).map((r, i) => (
          <PortalRow key={r.portalId} result={r} isBest={i === 0} />
        ))}
        {extraCount > 0 && (
          <button
            onClick={() => setMobileExpanded((v) => !v)}
            className="w-full px-4 py-2 text-sm text-blue-600 bg-gray-50 text-center"
          >
            {mobileExpanded ? 'Show less' : `+${extraCount} more option${extraCount > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Desktop — show all rows */}
      <div className="hidden md:block">
        {result.portalResults.map((r, i) => (
          <PortalRow key={r.portalId} result={r} isBest={i === 0} />
        ))}
      </div>

      {/* Transfer hack — amber section, collapsed by default */}
      {hasHack && (
        <div className="border-t border-amber-200">
          <button
            onClick={() => setHackExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
          >
            <span className="text-sm font-semibold text-amber-700">
              Hack available — transfer beats portal
            </span>
            <span className="text-amber-500 text-xs ml-2">
              {hackExpanded ? '▲ Hide' : '▼ Show'}
            </span>
          </button>
          {hackExpanded &&
            betterTransfers.map((t, i) => (
              <TransferRow
                key={`${t.sourcePortalId}-${t.partnerProgram}-${i}`}
                transfer={t}
              />
            ))}
        </div>
      )}
    </div>
  );
}
