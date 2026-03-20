'use client';

import { useState } from 'react';
import { PointsResult, PortalGroup, PortalResult, TransferResult, PORTAL_NAMES } from '@/lib/points/types';
import { useTheme } from '@/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pointCurrency(portalId: string): string {
  switch (portalId) {
    case 'chase':        return 'UR';
    case 'amex':         return 'MR';
    case 'capital_one':  return 'miles';
    case 'bilt':         return 'pts';
    case 'citi':         return 'TY';
    default:             return 'pts';
  }
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function cppTier(cpp: number): { label: string; cls: string } {
  if (cpp >= 2.0) return { label: 'Excellent',  cls: 'bg-cv-green-800 text-cv-green-100' };
  if (cpp >= 1.5) return { label: 'Great',       cls: 'bg-cv-green-700 text-cv-green-100' };
  if (cpp >  1.0) return { label: 'Above face',  cls: 'bg-cv-green-800/50 text-cv-green-300' };
  if (cpp === 1.0) return { label: '= Cash',      cls: 'bg-cv-amber-900/50 text-cv-white-300' };
  return               { label: 'Below face',  cls: 'bg-orange-900/40 text-orange-400'  };
}

// ---------------------------------------------------------------------------
// CardRow — one CPP tier within a portal group
// ---------------------------------------------------------------------------

function CardRow({
  result,
  showCardName,
}: {
  result: PortalResult;
  isBest: boolean;
  /** Only show card name when the portal has multiple CPP tiers */
  showCardName: boolean;
}) {
  const { isDark } = useTheme();
  const ptsCls   = isDark ? 'text-white/70'      : 'text-cv-blue-950';
  const earnCls  = isDark ? 'text-cv-amber-400'  : 'text-cv-amber-600';
  const labelCls = isDark ? 'text-cv-blue-400'   : 'text-cv-blue-400';
  const mathCls  = isDark ? 'text-cv-blue-300'   : 'text-cv-blue-300';
  const divCls   = isDark ? 'bg-cv-blue-900'     : 'bg-cv-blue-100';

  const tier = cppTier(result.centsPerPoint);
  const earnCashValue = Math.round(result.pointsEarned * result.centsPerPoint / 100);

  return (
    <div className="flex flex-col gap-2">
      {/* Card name only shown when portal has multiple CPP tiers */}
      {showCardName && (
        <span className={`text-xs font-medium ${isDark ? 'text-white/60' : 'text-cv-blue-600'}`}>
          {result.cardName}
        </span>
      )}

      {/* Two key stats */}
      <div className="flex items-start gap-5">
        <div className="flex flex-col gap-0.5">
          <span className={`text-[10px] uppercase tracking-wide ${labelCls}`}>Points to redeem</span>
          <span className={`text-sm font-semibold tabular-nums ${ptsCls}`}>
            {result.pointsNeeded.toLocaleString()} {pointCurrency(result.portalId)}
          </span>
          <span className={`text-[10px] tabular-nums ${mathCls}`}>
            {fmtUsd(result.priceUsd)} ÷ {result.centsPerPoint}¢/pt
          </span>
        </div>
        <div className={`w-px self-stretch ${divCls}`} />
        <div className="flex flex-col gap-0.5">
          <span className={`text-[10px] uppercase tracking-wide ${labelCls}`}>Effective value</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold tabular-nums ${ptsCls}`}>
              {result.centsPerPoint}¢/pt
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tier.cls}`}>
              {tier.label}
            </span>
          </div>
        </div>
      </div>

      {/* Earn row */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className={labelCls}>Pay cash & earn</span>
        <span className={`font-semibold tabular-nums ${earnCls}`}>
          +{result.pointsEarned.toLocaleString()} {pointCurrency(result.portalId)}
        </span>
        <span className={`tabular-nums ${mathCls}`}>≈ {fmtUsd(earnCashValue)}</span>
        <span className={mathCls}>({fmtUsd(result.priceUsd)} × {result.earnRate}x)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PortalGroupSection — issuer header + card rows
// ---------------------------------------------------------------------------

function PortalGroupSection({
  group,
  globalBestPts,
}: {
  group: PortalGroup;
  globalBestPts: number;
}) {
  const { isDark } = useTheme();
  const borderCls  = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const headerCls  = isDark ? 'text-white/50'      : 'text-cv-blue-400';
  const priceCls   = isDark ? 'text-cv-blue-300'   : 'text-cv-blue-950';
  const dividerCls = isDark ? 'border-cv-blue-900/60' : 'border-cv-blue-50';

  const isGroupBest = group.results[0].pointsNeeded === globalBestPts;
  const multiCpp    = group.results.length > 1;

  return (
    <div className={`border-b ${borderCls} last:border-0`}>
      {/* Portal header: name + best badge (inline) + price on right */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${headerCls}`}>
            {group.portalName}
          </span>
          {isGroupBest && (
            <span className="px-2 py-0.5 rounded-full bg-cv-green-700 text-cv-green-100 text-[10px] font-semibold uppercase tracking-wide">
              Best value
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold tabular-nums ${priceCls}`}>
          {fmtUsd(group.priceUsd)}
        </span>
      </div>

      {/* Card rows (one per distinct CPP tier) */}
      <div className="px-5 pb-3 flex flex-col gap-3">
        {group.results.map((r, i) => (
          <div key={r.cardId}>
            {i > 0 && <div className={`border-t ${dividerCls} mb-3`} />}
            <CardRow
              result={r}
              isBest={r.pointsNeeded === globalBestPts}
              showCardName={multiCpp}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransferRow
// ---------------------------------------------------------------------------

function TransferRow({
  transfer,
  isBest,
  priceUsd,
}: {
  transfer: TransferResult;
  isBest: boolean;
  priceUsd: number;
}) {
  const { isDark } = useTheme();
  const rowBorder  = isDark ? 'border-cv-blue-900' : 'border-cv-amber-200';
  const dividerCls = isDark ? 'bg-cv-blue-900'     : 'bg-cv-amber-200';
  const ptsCls     = isBest ? 'text-cv-green-400'  : 'text-cv-amber-400';
  const labelCls   = isDark ? 'text-cv-amber-600'  : 'text-cv-amber-500';
  const mathCls    = isDark ? 'text-cv-amber-700'  : 'text-cv-amber-400/60';

  const tier = transfer.transferCpp !== null ? cppTier(transfer.transferCpp) : null;

  return (
    <div className={`px-5 py-3.5 border-b ${rowBorder} last:border-0`}>
      {/* Program + source portal + best badge */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cv-amber-400 shrink-0" />
          <span className="text-sm font-medium text-cv-amber-400">{transfer.partnerProgram}</span>
          <span className={`text-xs ${labelCls}`}>{transfer.transferRatio}</span>
          <span className={`text-xs ${labelCls}`}>via {PORTAL_NAMES[transfer.sourcePortalId]}</span>
        </div>
        {isBest && (
          <span className="px-2 py-0.5 rounded-full bg-cv-green-700 text-cv-green-100 text-[10px] font-semibold uppercase tracking-wide">
            Best value
          </span>
        )}
      </div>

      {transfer.estimatedPointsNeeded !== null ? (
        <div className="flex items-start gap-5">
          <div className="flex flex-col gap-0.5">
            <span className={`text-[10px] uppercase tracking-wide ${labelCls}`}>Points to redeem</span>
            <span className={`text-sm font-semibold tabular-nums ${ptsCls}`}>
              {transfer.estimatedPointsNeeded.toLocaleString()} pts
            </span>
            {transfer.transferCpp !== null && (
              <span className={`text-[10px] tabular-nums ${mathCls}`}>
                {fmtUsd(priceUsd)} ÷ {transfer.estimatedPointsNeeded.toLocaleString()} pts = {transfer.transferCpp}¢/pt est.
              </span>
            )}
          </div>
          {tier && (
            <>
              <div className={`w-px self-stretch ${dividerCls}`} />
              <div className="flex flex-col gap-0.5">
                <span className={`text-[10px] uppercase tracking-wide ${labelCls}`}>Effective value</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold tabular-nums ${ptsCls}`}>
                    {transfer.transferCpp}¢/pt
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tier.cls}`}>
                    {tier.label}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className={`text-xs ${mathCls}`}>Award chart pricing — check program directly</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PointsGrid
// ---------------------------------------------------------------------------

export function PointsGrid({ result, collapseAfter }: { result: PointsResult; collapseAfter?: number }) {
  const { isDark } = useTheme();
  const [hackExpanded, setHackExpanded] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(false);

  const betterTransfers = result.transferAlternatives.filter((t) => t.isBetterThanPortal);
  const hasHack  = betterTransfers.length > 0;
  const cashOnly = result.bestPortalResult.centsPerPoint === 1.0;

  // Global best points across portals + transfers
  const transferMinPts = betterTransfers
    .map((t) => t.estimatedPointsNeeded ?? Infinity)
    .reduce((a, b) => Math.min(a, b), Infinity);
  const globalBestPts = Math.min(result.bestPortalResult.pointsNeeded, transferMinPts);

  const disclaimer =
    hasHack && cashOnly
      ? 'Best portal matches cash value only (1¢/pt) — transfer partners above offer better value. Award estimates are flat saver rates; availability varies.'
      : hasHack
      ? 'Transfer partners may beat portal value — see section above. Award estimates are flat saver rates; availability varies.'
      : cashOnly
      ? 'Best portal redeems at 1¢/pt — equivalent to paying cash. No points uplift available with your current cards.'
      : 'Estimates based on market rates — actual portal prices may differ. Point currencies are not interchangeable (UR ≠ MR ≠ miles).';

  const limit       = collapseAfter ?? result.portalGroups.length;
  const visible     = groupsExpanded ? result.portalGroups : result.portalGroups.slice(0, limit);
  const hiddenCount = result.portalGroups.length - limit;

  const containerBg  = isDark ? 'bg-cv-blue-900' : 'bg-white border border-cv-blue-100';
  const moreButtonBg = isDark ? 'bg-cv-blue-950 text-cv-blue-400' : 'bg-cv-blue-50 text-cv-blue-600';
  const hackHeaderBg = isDark ? 'bg-cv-blue-950 hover:bg-cv-blue-900' : 'bg-cv-amber-50 hover:bg-cv-amber-100';
  const hackBorder   = isDark ? 'border-cv-amber-900' : 'border-cv-amber-200';

  return (
    <div className={`rounded-xl overflow-hidden ${containerBg}`}>

      {visible.map((g) => (
        <PortalGroupSection key={g.portalId} group={g} globalBestPts={globalBestPts} />
      ))}

      {hiddenCount > 0 && (
        <button
          onClick={() => setGroupsExpanded((v) => !v)}
          className={`w-full px-5 py-2.5 text-xs font-medium text-center ${moreButtonBg}`}
        >
          {groupsExpanded ? 'Show less' : `+${hiddenCount} more portal${hiddenCount > 1 ? 's' : ''}`}
        </button>
      )}

      {/* Transfer section */}
      {hasHack && (
        <div className={`border-t ${hackBorder}`}>
          <button
            onClick={() => setHackExpanded((v) => !v)}
            className={`w-full flex items-center justify-between px-5 py-3 transition-colors text-left ${hackHeaderBg}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cv-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-cv-amber-400 uppercase tracking-wide">
                Transfer beats credit card portals
              </span>
            </div>
            <span className="text-cv-amber-600 text-xs ml-2">{hackExpanded ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {hackExpanded &&
            betterTransfers.map((t, i) => (
              <TransferRow
                key={`${t.sourcePortalId}-${t.partnerProgram}-${i}`}
                transfer={t}
                isBest={(t.estimatedPointsNeeded ?? Infinity) === globalBestPts}
                priceUsd={result.priceUsd}
              />
            ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className={`px-5 py-2.5 text-[10px] leading-relaxed border-t ${isDark ? 'border-cv-blue-800 text-cv-blue-500' : 'border-cv-blue-100 text-cv-blue-400'}`}>
        {disclaimer}
      </p>
    </div>
  );
}
