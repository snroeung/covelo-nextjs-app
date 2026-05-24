'use client';

import { useState } from 'react';
import { PointsResult, PortalGroup, TransferResult, PORTAL_NAMES } from '@/lib/points/types';
import { useTheme } from '@/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pointCurrency(portalId: string): string {
  switch (portalId) {
    case 'chase':       return 'UR';
    case 'amex':        return 'MR';
    case 'capital_one': return 'miles';
    case 'bilt':        return 'pts';
    case 'citi':        return 'TY';
    default:            return 'pts';
  }
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const CPP_MAX = 2.0;

function cppTier(cpp: number): { label: string; chipBg: string; chipFg: string; barColor: string } {
  if (cpp >= 2.0) return { label: 'Excellent',  chipBg: '#dcf3e3', chipFg: '#0f7536', barColor: '#0f9d58' };
  if (cpp >= 1.5) return { label: 'Great',       chipBg: '#dcf3e3', chipFg: '#0f7536', barColor: '#0f9d58' };
  if (cpp >  1.0) return { label: 'Above face',  chipBg: '#e8f5eb', chipFg: '#3f8f4e', barColor: '#22C55E' };
  if (cpp === 1.0) return { label: '= Cash',     chipBg: '#f0f0ee', chipFg: '#5f6066', barColor: '#8a8a90' };
  return               { label: 'Below face',  chipBg: '#fde3cf', chipFg: '#a14a16', barColor: '#ea7a2c' };
}

function ptsCostLabel(pts: number, allPts: number[]): string {
  const min = Math.min(...allPts);
  const max = Math.max(...allPts);
  if (min === max) return '';
  if (pts === min) return 'lowest cost';
  if (pts === max) return 'highest cost';
  return 'moderate';
}

// ---------------------------------------------------------------------------
// Grid column template — shared between ColHeaders and PortalRow
// ---------------------------------------------------------------------------

const COL = '1.4fr 0.85fr 1.5fr 1.7fr 1.3fr 90px';

// ---------------------------------------------------------------------------
// Column headers (desktop only)
// ---------------------------------------------------------------------------

function ColHeaders({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`hidden md:grid border-b text-[9px] font-bold font-mono uppercase tracking-widest px-5 py-2.5 gap-3.5 ${
        isDark ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-muted' : 'bg-gray-50 border-gray-200 text-gray-400'
      }`}
      style={{ gridTemplateColumns: COL }}
    >
      <span>Portal</span>
      <span>Cash</span>
      <span>Redeem with points</span>
      <span>Value · ¢/pt</span>
      <span>Pay cash &amp; earn</span>
      <span />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PortalRow — one row per issuer portal
// ---------------------------------------------------------------------------

function PortalRow({
  group,
  isBest,
  delta,
  allBestPts,
  isDark,
}: {
  group: PortalGroup;
  isBest: boolean;
  delta: number;
  allBestPts: number[];
  isDark: boolean;
}) {
  const best    = group.results[0];
  const program = pointCurrency(group.portalId);
  const tier    = cppTier(best.centsPerPoint);
  const barPct  = Math.min(100, (best.centsPerPoint / CPP_MAX) * 100);
  const earnCashValue = Math.round(best.pointsEarned * best.centsPerPoint / 100);
  const costLabel = ptsCostLabel(best.pointsNeeded, allBestPts);

  const inkCls   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const mutedCls = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowBg    = isBest
    ? isDark ? 'bg-green-950/25' : 'bg-green-50/80'
    : '';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const barTrack  = isDark ? '#262629' : '#e3e3e1';
  const tickColor = isDark ? '#8a8a90' : '#5f6066';

  const bookBtn = `px-3 py-1.5 rounded text-xs font-bold transition-colors ${
    isBest
      ? 'bg-green-600 hover:bg-green-700 text-white'
      : isDark
        ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi'
        : 'bg-gray-900 hover:bg-gray-700 text-white'
  }`;

  return (
    <div className={`relative border-b last:border-b-0 ${borderCls} ${rowBg}`}>
      {/* Best-portal accent bar */}
      {isBest && <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-green-500" />}

      {/* ── Desktop: grid row ─────────────────────────────────────────── */}
      <div
        className="hidden md:grid items-center px-5 py-4 gap-3.5"
        style={{ gridTemplateColumns: COL }}
      >
        {/* Portal name */}
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />
            <span className={`text-sm font-semibold ${inkCls}`}>{group.portalName}</span>
          </div>
          {isBest && (
            <div className="mt-1 ml-4 text-[9px] font-bold font-mono tracking-widest uppercase text-green-600">
              ↑ Best value
            </div>
          )}
          {group.results.length > 1 && (
            <div className={`mt-0.5 ml-4 text-[9px] font-mono ${mutedCls}`}>
              {group.results.length} card tiers
            </div>
          )}
        </div>

        {/* Cash + delta */}
        <div>
          <div className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>{fmtUsd(group.priceUsd)}</div>
          {delta !== 0 && (
            <div className={`text-[10px] font-bold font-mono mt-0.5 tracking-wide ${delta < 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {delta < 0 ? '↓ ' : '↑ +'}{fmtUsd(Math.abs(delta))}
            </div>
          )}
          {delta === 0 && (
            <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>baseline</div>
          )}
        </div>

        {/* Points */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>
              {best.pointsNeeded.toLocaleString()}
            </span>
            <span className={`text-xs font-medium ${mutedCls}`}>{program}</span>
          </div>
          {costLabel && <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>{costLabel}</div>}
        </div>

        {/* Value + bar */}
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>{best.centsPerPoint}¢</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide"
              style={{ background: tier.chipBg, color: tier.chipFg }}
            >
              {tier.label}
            </span>
          </div>
          {/* ¢/pt bar — 0 to 2¢, tick at face value (1¢ = 50%) */}
          <div className="relative mt-2 h-0.75 rounded-full max-w-40" style={{ background: barTrack }}>
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{ width: `${barPct}%`, background: tier.barColor }}
            />
            <div
              className="absolute -top-0.75 -bottom-0.75 w-px opacity-40"
              style={{ left: '50%', background: tickColor }}
            />
          </div>
          <div className={`flex justify-between text-[8px] font-mono mt-1 max-w-40 ${mutedCls}`}>
            <span>0¢</span><span>face</span><span>2¢+</span>
          </div>
        </div>

        {/* Earn-back */}
        <div>
          {best.pointsEarned > 0 ? (
            <>
              <div className={`text-xs font-mono font-semibold tabular-nums ${inkCls}`}>
                +{best.pointsEarned.toLocaleString()} {program}
              </div>
              <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>
                ≈ {fmtUsd(earnCashValue)} back · {best.earnRate}× card
              </div>
            </>
          ) : (
            <div className={`text-[10px] font-mono italic leading-relaxed ${mutedCls}`}>
              direct award —<br />no earn-back
            </div>
          )}
        </div>

        {/* Book */}
        <div className="flex justify-end">
          <button className={bookBtn}>Book →</button>
        </div>
      </div>

      {/* ── Mobile: compact card ──────────────────────────────────────── */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />
            <span className={`text-sm font-semibold ${inkCls}`}>{group.portalName}</span>
            {isBest && (
              <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-green-600">Best</span>
            )}
          </div>
          <button className={bookBtn}>Book →</button>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <div>
            <div className={`text-[9px] font-mono uppercase tracking-widest ${mutedCls}`}>Cash</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${inkCls}`}>{fmtUsd(group.priceUsd)}</div>
            {delta !== 0 && (
              <div className={`text-[9px] font-bold font-mono ${delta < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {delta < 0 ? '↓' : '↑+'}{fmtUsd(Math.abs(delta))}
              </div>
            )}
          </div>
          <div>
            <div className={`text-[9px] font-mono uppercase tracking-widest ${mutedCls}`}>Redeem</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${inkCls}`}>
              {best.pointsNeeded.toLocaleString()}{' '}
              <span className={`text-xs font-normal ${mutedCls}`}>{program}</span>
            </div>
          </div>
          <div>
            <div className={`text-[9px] font-mono uppercase tracking-widest ${mutedCls}`}>Value</div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold font-mono tabular-nums ${inkCls}`}>{best.centsPerPoint}¢</span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase"
                style={{ background: tier.chipBg, color: tier.chipFg }}
              >
                {tier.label}
              </span>
            </div>
          </div>
        </div>

        {/* Mini bar */}
        <div className="relative h-0.75 rounded-full" style={{ background: barTrack, maxWidth: 200 }}>
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${barPct}%`, background: tier.barColor }} />
          <div className="absolute -top-0.5 -bottom-0.5 w-px opacity-40" style={{ left: '50%', background: tickColor }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransferRow — transfer partner alternative, styled like PortalRow
// ---------------------------------------------------------------------------

function TransferRow({
  transfer,
  isBest,
  priceUsd,
  isDark,
}: {
  transfer: TransferResult;
  isBest: boolean;
  priceUsd: number;
  isDark: boolean;
}) {
  const tier     = transfer.transferCpp !== null ? cppTier(transfer.transferCpp) : null;
  const barPct   = transfer.transferCpp !== null ? Math.min(100, (transfer.transferCpp / CPP_MAX) * 100) : 0;
  const srcCur   = pointCurrency(transfer.sourcePortalId);

  const inkCls    = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const mutedCls  = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowBg     = isBest ? (isDark ? 'bg-green-950/25' : 'bg-green-50/80') : '';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const barTrack  = isDark ? '#262629' : '#e3e3e1';
  const tickColor = isDark ? '#8a8a90' : '#5f6066';

  const bookBtn = `px-3 py-1.5 rounded text-xs font-bold transition-colors ${
    isBest
      ? 'bg-green-600 hover:bg-green-700 text-white'
      : isDark
        ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi'
        : 'bg-gray-900 hover:bg-gray-700 text-white'
  }`;

  return (
    <div className={`relative border-b last:border-b-0 ${borderCls} ${rowBg}`}>
      {isBest && <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-green-500" />}

      {/* ── Desktop: grid row ─────────────────────────────────────────── */}
      <div
        className="hidden md:grid items-center px-5 py-4 gap-3.5"
        style={{ gridTemplateColumns: COL }}
      >
        {/* Partner + source portal */}
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : 'bg-cv-amber-400'}`} />
            <span className={`text-sm font-semibold ${inkCls}`}>{transfer.partnerProgram}</span>
          </div>
          {isBest && (
            <div className="mt-1 ml-4 text-[9px] font-bold font-mono tracking-widest uppercase text-green-600">
              ↑ Best value
            </div>
          )}
          <div className={`mt-0.5 ml-4 text-[9px] font-mono ${mutedCls}`}>
            via {PORTAL_NAMES[transfer.sourcePortalId]} · {transfer.transferRatio}
          </div>
        </div>

        {/* Cash */}
        <div>
          <div className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>{fmtUsd(priceUsd)}</div>
        </div>

        {/* Points to redeem */}
        <div>
          {transfer.estimatedPointsNeeded !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>
                {transfer.estimatedPointsNeeded.toLocaleString()}
              </span>
              <span className={`text-xs font-medium ${mutedCls}`}>{srcCur}</span>
            </div>
          ) : (
            <span className={`text-xs italic ${mutedCls}`}>check program</span>
          )}
        </div>

        {/* Value + bar */}
        <div>
          {tier && transfer.transferCpp !== null ? (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>{transfer.transferCpp}¢</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide"
                  style={{ background: tier.chipBg, color: tier.chipFg }}
                >
                  {tier.label}
                </span>
              </div>
              <div className="relative mt-2 h-0.75 rounded-full max-w-40" style={{ background: barTrack }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${barPct}%`, background: tier.barColor }}
                />
                <div
                  className="absolute -top-0.75 -bottom-0.75 w-px opacity-40"
                  style={{ left: '50%', background: tickColor }}
                />
              </div>
              <div className={`flex justify-between text-[8px] font-mono mt-1 max-w-40 ${mutedCls}`}>
                <span>0¢</span><span>face</span><span>2¢+</span>
              </div>
            </>
          ) : (
            <span className={`text-xs italic ${mutedCls}`}>—</span>
          )}
        </div>

        {/* Earn-back — not applicable for award transfers */}
        <div>
          <div className={`text-[10px] font-mono italic leading-relaxed ${mutedCls}`}>
            direct award —<br />no earn-back
          </div>
        </div>

        {/* Transfer button */}
        <div className="flex justify-end">
          <button className={bookBtn}>Transfer →</button>
        </div>
      </div>

      {/* ── Mobile: compact card ──────────────────────────────────────── */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : 'bg-cv-amber-400'}`} />
            <span className={`text-sm font-semibold ${inkCls}`}>{transfer.partnerProgram}</span>
            {isBest && (
              <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-green-600">Best</span>
            )}
          </div>
          <button className={bookBtn}>Transfer →</button>
        </div>

        <div className={`text-[9px] font-mono ml-4 ${mutedCls}`}>
          via {PORTAL_NAMES[transfer.sourcePortalId]} · {transfer.transferRatio}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <div>
            <div className={`text-[9px] font-mono uppercase tracking-widest ${mutedCls}`}>Cash</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${inkCls}`}>{fmtUsd(priceUsd)}</div>
          </div>
          {transfer.estimatedPointsNeeded !== null && (
            <div>
              <div className={`text-[9px] font-mono uppercase tracking-widest ${mutedCls}`}>Redeem</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${inkCls}`}>
                {transfer.estimatedPointsNeeded.toLocaleString()}{' '}
                <span className={`text-xs font-normal ${mutedCls}`}>{srcCur}</span>
              </div>
            </div>
          )}
          {tier && transfer.transferCpp !== null && (
            <div>
              <div className={`text-[9px] font-mono uppercase tracking-widest ${mutedCls}`}>Value</div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold font-mono tabular-nums ${inkCls}`}>{transfer.transferCpp}¢</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase"
                  style={{ background: tier.chipBg, color: tier.chipFg }}
                >
                  {tier.label}
                </span>
              </div>
            </div>
          )}
        </div>

        {tier && (
          <div className="relative h-0.75 rounded-full" style={{ background: barTrack, maxWidth: 200 }}>
            <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${barPct}%`, background: tier.barColor }} />
            <div className="absolute -top-0.5 -bottom-0.5 w-px opacity-40" style={{ left: '50%', background: tickColor }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PointsGrid — main export
// ---------------------------------------------------------------------------

export function PointsGrid({
  result,
  collapseAfter,
  itemName,
  itemMeta,
}: {
  result: PointsResult;
  collapseAfter?: number;
  itemName?: string;
  itemMeta?: string;
}) {
  const { isDark } = useTheme();
  const [hackExpanded, setHackExpanded] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(false);

  const betterTransfers = result.transferAlternatives.filter(t => t.isBetterThanPortal);
  const hasHack  = betterTransfers.length > 0;
  const cashOnly = result.bestPortalResult.centsPerPoint === 1.0;

  const allBestPts   = result.portalGroups.map(g => g.results[0].pointsNeeded);
  const globalBestPts = Math.min(...allBestPts);

  const prices      = result.portalGroups.map(g => g.priceUsd);
  const minPrice    = Math.min(...prices);
  const maxPrice    = Math.max(...prices);
  const priceRange  = maxPrice - minPrice;
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const baselinePrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

  const limit       = collapseAfter ?? result.portalGroups.length;
  const visible     = groupsExpanded ? result.portalGroups : result.portalGroups.slice(0, limit);
  const hiddenCount = result.portalGroups.length - limit;

  const transferMinPts = betterTransfers
    .map(t => t.estimatedPointsNeeded ?? Infinity)
    .reduce((a, b) => Math.min(a, b), Infinity);
  const globalBestAll = Math.min(globalBestPts, transferMinPts);

  const containerBg  = isDark ? 'bg-gph-dark-card'    : 'bg-white';
  const borderCls    = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const inkCls       = isDark ? 'text-gph-dark-ink'    : 'text-gray-900';
  const mutedCls     = isDark ? 'text-gph-dark-muted'  : 'text-gray-500';
  const moreButtonBg = isDark ? 'bg-gph-dark-bg text-gph-dark-muted hover:bg-gph-dark-linesoft' : 'bg-gray-50 text-gray-500 hover:bg-gray-100';

  const disclaimer =
    hasHack && cashOnly
      ? 'Best portal matches cash value only (1¢/pt) — transfer partners above offer better value. Award estimates are flat saver rates; availability varies.'
      : hasHack
      ? 'Transfer partners may beat portal value — see above. Award estimates are flat saver rates; availability varies.'
      : cashOnly
      ? 'Best portal redeems at 1¢/pt — equivalent to paying cash. No points uplift available with your current cards.'
      : 'Estimates based on market rates — actual portal prices may differ.';

  return (
    <div className={`overflow-hidden ${containerBg}`}>

      {/* ── Header: cash range (only shown when portals have different prices) */}
      {(priceRange > 0 || itemName) && (
        <div className={`flex items-center justify-between gap-4 px-5 py-3 border-b ${borderCls} ${isDark ? 'bg-gph-dark-bg' : 'bg-gray-50'}`}>
          <div className="min-w-0">
            <div className={`text-[9px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
              Compare · {result.portalGroups.length} portal{result.portalGroups.length !== 1 ? 's' : ''}
            </div>
            {itemName && <div className={`text-sm font-semibold truncate mt-0.5 ${inkCls}`}>{itemName}</div>}
            {itemMeta && <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>{itemMeta}</div>}
          </div>
          {priceRange > 0 && (
            <div className="text-right shrink-0">
              <div className={`text-[9px] font-mono uppercase tracking-widest ${mutedCls}`}>Cash range</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${inkCls}`}>
                {fmtUsd(minPrice)} <span className={mutedCls}>→</span> {fmtUsd(maxPrice)}
              </div>
              <div className="text-[10px] font-bold font-mono text-green-600 tracking-wide mt-0.5">
                ↓ Save up to {fmtUsd(priceRange)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Column headers (desktop) */}
      <ColHeaders isDark={isDark} />

      {/* ── Portal rows */}
      {visible.map(g => (
        <PortalRow
          key={g.portalId}
          group={g}
          isBest={g.results[0].pointsNeeded === globalBestPts}
          delta={g.priceUsd - baselinePrice}
          allBestPts={allBestPts}
          isDark={isDark}
        />
      ))}

      {/* ── Show more / collapse */}
      {!groupsExpanded && hiddenCount > 0 && (
        <button
          onClick={() => setGroupsExpanded(true)}
          className={`w-full px-5 py-2.5 text-xs font-medium text-center border-t transition-colors ${borderCls} ${moreButtonBg}`}
        >
          +{hiddenCount} more portal{hiddenCount > 1 ? 's' : ''}
        </button>
      )}
      {groupsExpanded && hiddenCount > 0 && (
        <button
          onClick={() => setGroupsExpanded(false)}
          className={`w-full px-5 py-2.5 text-xs font-medium text-center border-t transition-colors ${borderCls} ${moreButtonBg}`}
        >
          Show less
        </button>
      )}

      {/* ── Transfer section */}
      {hasHack && (
        <div className={`border-t ${borderCls}`}>
          <button
            onClick={() => setHackExpanded(v => !v)}
            className={`w-full flex items-center justify-between px-5 py-2.5 transition-colors text-left ${
              isDark ? 'bg-gph-dark-bg hover:bg-gph-dark-linesoft' : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cv-amber-400 shrink-0" />
              <span className={`text-[9px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
                Airline Transfer Partners
              </span>
              <span className={`text-[9px] font-mono ${mutedCls}`}>
                · {betterTransfers.length} option{betterTransfers.length !== 1 ? 's' : ''}
              </span>
            </div>
            <svg
              className={`w-3 h-3 transition-transform ${hackExpanded ? 'rotate-180' : ''} ${mutedCls}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {hackExpanded &&
            betterTransfers.map((t, i) => (
              <TransferRow
                key={`${t.sourcePortalId}-${t.partnerProgram}-${i}`}
                transfer={t}
                isBest={(t.estimatedPointsNeeded ?? Infinity) === globalBestAll}
                priceUsd={result.priceUsd}
                isDark={isDark}
              />
            ))}
        </div>
      )}

      {/* ── Footer */}
      <p className={`px-5 py-2.5 text-[10px] leading-relaxed border-t ${isDark ? 'border-gph-dark-line text-gph-dark-muted' : 'border-gray-200 text-gray-400'}`}>
        {disclaimer}
        {' '}Bar = ¢/pt vs face value (1¢). Earn-back assumes current card multipliers. UR ≠ MR ≠ miles.
      </p>
    </div>
  );
}
