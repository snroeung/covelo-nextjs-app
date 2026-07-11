'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PointsResult, PortalGroup, TransferResult, PortalId, EligibleTransferCard, PORTAL_NAMES, CHASE_LEGACY_RATE_SUNSET_DATE } from '@/lib/points/types';
import { rankOptions } from '@/lib/points/rankOptions';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import type { TransferBonus, Issuer } from '@/lib/types/offers';

const ISSUER_TO_PORTAL: Record<Issuer, PortalId> = {
  chase: 'chase', amex: 'amex', c1: 'capital_one', bilt: 'bilt', citi: 'citi',
};

const ISSUER_LOYALTY_NAME: Record<Issuer, string> = {
  chase: 'Chase Ultimate Rewards',
  amex: 'Amex Membership Rewards',
  c1: 'Capital One Miles',
  bilt: 'Bilt Rewards',
  citi: 'Citi ThankYou Rewards',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pointCurrency(portalId: string): string {
  return portalId === 'capital_one' ? 'mi' : 'pts';
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function cppTier(cpp: number): { label: string; chipBg: string; chipFg: string } {
  if (cpp >= 2.0) return { label: 'Excellent',  chipBg: '#dcf3e3', chipFg: '#0f7536' };
  if (cpp >= 1.5) return { label: 'Great',       chipBg: '#dcf3e3', chipFg: '#0f7536' };
  if (cpp >  1.0) return { label: 'Above face',  chipBg: '#e8f5eb', chipFg: '#3f8f4e' };
  if (cpp === 1.0) return { label: '= Cash',     chipBg: '#f0f0ee', chipFg: '#5f6066' };
  return               { label: 'Below face',  chipBg: '#e2e8f0', chipFg: '#475569' };
}

function EstMark({ isDark, title }: { isDark: boolean; title?: string }) {
  return (
    <span
      tabIndex={0}
      title={title ?? 'Estimated from recent portal pricing'}
      className={`text-[9px] font-mono border-b border-dotted cursor-help ${
        isDark ? 'text-gph-dark-muted border-gph-dark-muted' : 'text-gray-400 border-gray-300'
      }`}
    >
      est.
    </span>
  );
}

// Chase Travel replaced fixed redemption rates with Points Boost for cardholders
// who applied 2025-06-23+. We don't ask which cohort the user is in, so when a
// chase_reserve/chase_preferred card is selected, calcPoints() emits both a
// legacy-rate row and a new-baseline-rate row — surface both here.
function chaseVariants(group: PortalGroup): { legacy: PortalGroup['results'][number]; newRate: PortalGroup['results'][number] } | null {
  const legacy = group.results.find(r => r.chaseRateVariant === 'legacy');
  const newRate = group.results.find(r => r.chaseRateVariant === 'new');
  return legacy && newRate ? { legacy, newRate } : null;
}

function BestValuePill({ isDark }: { isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase tracking-wide ${
      isDark ? 'bg-green-950/50 text-green-400' : 'bg-green-100 text-green-700'
    }`}>
      ★ Best value
    </span>
  );
}

function TransferPartnerPill({ isDark }: { isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase tracking-wide ${
      isDark ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-100 text-blue-700'
    }`}>
      ⇄ Transfer partner
    </span>
  );
}

// ---------------------------------------------------------------------------
// Grid column template — shared between ColHeaders, PortalRow, TransferRow
// ---------------------------------------------------------------------------

const COL = '1.4fr 1fr 1fr 0.9fr 0.7fr';

// ---------------------------------------------------------------------------
// Column headers (desktop only)
// ---------------------------------------------------------------------------

function ColHeaders({ isDark, compact }: { isDark: boolean; compact?: boolean }) {
  if (compact) return null;
  const hintCls = isDark ? 'text-gph-dark-muted border-gph-dark-muted' : 'text-gray-400 border-gray-300';
  return (
    <div
      className={`hidden md:grid border-b text-[9px] font-bold font-mono uppercase tracking-widest px-5 py-2.5 gap-3.5 ${
        isDark ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-muted' : 'bg-gray-50 border-gray-200 text-gray-400'
      }`}
      style={{ gridTemplateColumns: COL }}
    >
      <span>Portal</span>
      <span className="flex items-center gap-1">
        Value
        <span className={`normal-case text-[8px] border-b border-dotted ${hintCls}`}>¢/pt · est.</span>
      </span>
      <span>Cost to redeem</span>
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
  isDark,
  compact,
}: {
  group: PortalGroup;
  isBest: boolean;
  isDark: boolean;
  compact?: boolean;
}) {
  const best    = group.results[0];
  const chaseVariant = chaseVariants(group);
  const program = pointCurrency(group.portalId);
  const tier    = cppTier(best.centsPerPoint);

  const inkCls   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const mutedCls = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowBg    = isBest
    ? isDark ? 'bg-green-950/25' : 'bg-green-50/80'
    : '';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';

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
        className={`${compact ? 'hidden' : 'hidden md:grid'} items-center px-5 py-4 gap-3.5`}
        style={{ gridTemplateColumns: COL }}
      >
        {/* Portal name */}
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />
            <span className={`text-sm font-semibold ${inkCls}`}>{group.portalName}</span>
          </div>
          {isBest && <div className="mt-1 ml-4"><BestValuePill isDark={isDark} /></div>}
          <div className={`mt-1 ml-4 text-[9px] font-mono ${mutedCls}`}>
            {best.cardName}{group.results.length > 1 ? ` · ${group.results.length} card tiers` : ''}
          </div>
          {chaseVariant && (
            <div className={`mt-1 ml-4 text-[9px] font-mono leading-relaxed ${isDark ? 'text-cv-amber-400' : 'text-amber-700'}`}>
              Rate depends on card-open date — legacy {chaseVariant.legacy.centsPerPoint}¢/pt ({chaseVariant.legacy.pointsNeeded.toLocaleString()} pts) vs. Points Boost {chaseVariant.newRate.centsPerPoint}¢/pt ({chaseVariant.newRate.pointsNeeded.toLocaleString()} pts)
            </div>
          )}
        </div>

        {/* Value */}
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold font-mono tabular-nums ${inkCls}`}>{best.centsPerPoint}¢</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide"
            style={{ background: tier.chipBg, color: tier.chipFg }}
          >
            {tier.label}
          </span>
        </div>

        {/* Cost to redeem */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-sm font-semibold font-mono tabular-nums ${inkCls}`}>
              {best.pointsNeeded.toLocaleString()}
            </span>
            <span className={`text-xs font-medium ${mutedCls}`}>{program}</span>
            <EstMark isDark={isDark} />
          </div>
          <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>or {fmtUsd(group.priceUsd)} cash</div>
        </div>

        {/* Pay cash & earn */}
        <div>
          {best.pointsEarned > 0 ? (
            <div className={`text-xs font-mono ${mutedCls}`}>
              <span className={`font-semibold tabular-nums ${inkCls}`}>{fmtUsd(group.priceUsd)}</span> cash ·{' '}
              <span className={`font-semibold tabular-nums ${inkCls}`}>+{best.pointsEarned.toLocaleString()} {program}</span> ({best.earnRate}×)
            </div>
          ) : (
            <div className={`text-[10px] font-mono italic ${mutedCls}`}>direct award — no earn-back</div>
          )}
        </div>

        {/* Book */}
        <div className="flex justify-end">
          <button className={bookBtn}>Book →</button>
        </div>
      </div>

      {/* ── Mobile: compact card ──────────────────────────────────────── */}
      <div className={`${compact ? '' : 'md:hidden '}px-4 py-3 flex flex-col gap-2`}>
        {/* Row 1: portal + card + button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />
            <span className={`text-sm font-semibold truncate ${inkCls}`}>{group.portalName}</span>
            {isBest && <BestValuePill isDark={isDark} />}
            <span className={`text-[9px] font-mono truncate ${mutedCls}`}>{best.cardName}</span>
          </div>
          <button className={`shrink-0 ${bookBtn}`}>Book →</button>
        </div>
        {chaseVariant && (
          <div className={`text-[9px] font-mono ml-4 leading-relaxed ${isDark ? 'text-cv-amber-400' : 'text-amber-700'}`}>
            Legacy {chaseVariant.legacy.centsPerPoint}¢/pt ({chaseVariant.legacy.pointsNeeded.toLocaleString()} pts) vs. Points Boost {chaseVariant.newRate.centsPerPoint}¢/pt ({chaseVariant.newRate.pointsNeeded.toLocaleString()} pts)
          </div>
        )}

        {/* Row 2: value + redeem + earn */}
        <div className="flex items-center flex-wrap gap-x-5 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>{best.centsPerPoint}¢</span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase"
              style={{ background: tier.chipBg, color: tier.chipFg }}
            >
              {tier.label}
            </span>
          </div>
          <div className={`text-xs font-mono ${mutedCls}`}>
            <span className={`font-semibold tabular-nums ${inkCls}`}>{best.pointsNeeded.toLocaleString()}</span>{' '}
            {program} <EstMark isDark={isDark} /> · or {fmtUsd(group.priceUsd)} cash
          </div>
          <div className={`text-[10px] font-mono ${mutedCls}`}>
            {best.pointsEarned > 0 ? (
              <>
                <span className={`font-semibold ${inkCls}`}>{fmtUsd(group.priceUsd)}</span> cash ·{' '}
                <span className={`font-semibold ${inkCls}`}>+{best.pointsEarned.toLocaleString()} {program}</span> ({best.earnRate}×)
              </>
            ) : (
              <span className="italic">direct award — no earn-back</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransferCardChips — one chip per user card that can reach this partner
// ---------------------------------------------------------------------------

function formatRatioUnits(ratio: string, partnerType: 'hotel' | 'airline', partnerProgram: string): string {
  const [from, to] = ratio.split(':').map(Number);
  const toNoun = partnerType === 'airline' ? 'mile' : 'pt';
  const fromUnit = from === 1 ? 'pt' : 'pts';
  const toUnit = to === 1 ? toNoun : `${toNoun}s`;
  return `${from} card ${fromUnit} : ${to} ${partnerProgram} ${toUnit}`;
}

function groupByPortal(cards: EligibleTransferCard[]): [PortalId, EligibleTransferCard[]][] {
  const byPortal = new Map<PortalId, EligibleTransferCard[]>();
  for (const c of cards) {
    const list = byPortal.get(c.portalId) ?? [];
    list.push(c);
    byPortal.set(c.portalId, list);
  }
  return [...byPortal.entries()];
}

function TransferChip({
  label, cards, bg, fg, dashed, partnerType, partnerProgram,
}: {
  label: string;
  cards: EligibleTransferCard[];
  bg: string;
  fg: string;
  dashed?: boolean;
  partnerType: 'hotel' | 'airline';
  partnerProgram: string;
}) {
  return (
    <span
      tabIndex={0}
      className={`group relative px-1.5 py-0.5 rounded text-[9px] font-bold font-mono cursor-default focus:outline-none focus:ring-1 focus:ring-cv-lime-500 ${dashed ? 'border border-dashed border-current bg-transparent' : ''}`}
      style={dashed ? { color: fg } : { background: bg, color: fg }}
    >
      {label}
      <span className="pointer-events-none absolute left-0 top-full pt-1 z-20 hidden group-hover:block group-focus:block whitespace-nowrap">
        <span className="block rounded bg-cv-navy-950 text-white text-[9px] font-mono px-2 py-1 shadow-lg">
          {cards.map(c => `${c.cardName} · ${formatRatioUnits(c.ratio, partnerType, partnerProgram)}`).join(' · ')}
        </span>
      </span>
    </span>
  );
}

function CardSourceDropdown({
  label, cards, bg, fg, dashed, partnerType, partnerProgram,
}: {
  label: string;
  cards: EligibleTransferCard[];
  bg: string;
  fg: string;
  dashed?: boolean;
  partnerType: 'hotel' | 'airline';
  partnerProgram: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pinned) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [pinned]);

  function toggle() {
    if (pinned) {
      setOpen(false);
      setPinned(false);
    } else {
      setPinned(true);
      setOpen(true);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false); }}
    >
      <button
        type="button"
        onClick={toggle}
        className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-cv-lime-500 ${dashed ? 'border border-dashed border-current bg-transparent' : ''}`}
        style={dashed ? { color: fg } : { background: bg, color: fg }}
      >
        {label} · {cards.length} cards ⌄
      </button>
      {open && (
        <div className="absolute left-0 top-full pt-1 z-20 whitespace-nowrap">
          <div className="rounded bg-cv-navy-950 text-white text-[9px] font-mono px-2 py-1.5 shadow-lg flex flex-col gap-1">
            {cards.map(c => (
              <span key={c.cardName}>{c.cardName} · {formatRatioUnits(c.ratio, partnerType, partnerProgram)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TransferCardChips({
  transfer,
  tier,
  isDark,
}: {
  transfer: TransferResult;
  tier: ReturnType<typeof cppTier> | null;
  isDark: boolean;
}) {
  const mutedCls = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const owned = transfer.eligibleCards;
  const recommended = transfer.recommendedCards;

  if (owned.length === 0 && recommended.length === 0) {
    return (
      <div className={`mt-0.5 ml-4 text-[9px] font-mono ${mutedCls}`}>
        via {PORTAL_NAMES[transfer.sourcePortalId]} · {formatRatioUnits(transfer.transferRatio, transfer.partnerType, transfer.partnerProgram)}
      </div>
    );
  }

  const chipBg = tier?.chipBg ?? (isDark ? '#2a2a2d' : '#f0f0ee');
  const chipFg = tier?.chipFg ?? (isDark ? '#a8a8ae' : '#5f6066');

  if (owned.length > 0) {
    return (
      <div className="mt-1 ml-4 flex flex-wrap gap-1">
        {groupByPortal(owned).map(([portalId, cards]) => (
          cards.length > 1 ? (
            <CardSourceDropdown key={portalId} label={PORTAL_NAMES[portalId]} cards={cards} bg={chipBg} fg={chipFg} partnerType={transfer.partnerType} partnerProgram={transfer.partnerProgram} />
          ) : (
            <TransferChip key={portalId} label={PORTAL_NAMES[portalId]} cards={cards} bg={chipBg} fg={chipFg} partnerType={transfer.partnerType} partnerProgram={transfer.partnerProgram} />
          )
        ))}
      </div>
    );
  }

  // No owned card reaches this partner — recommend one that would
  const recBg = isDark ? '#2a2a2d' : '#f0f0ee';
  const recFg = isDark ? '#a8a8ae' : '#5f6066';
  return (
    <div className="mt-1 ml-4 flex flex-wrap items-center gap-1">
      <span className={`text-[9px] font-mono ${mutedCls}`}>Get:</span>
      {groupByPortal(recommended).map(([portalId, cards]) => (
        cards.length > 1 ? (
          <CardSourceDropdown key={portalId} label={PORTAL_NAMES[portalId]} cards={cards} bg={recBg} fg={recFg} dashed partnerType={transfer.partnerType} partnerProgram={transfer.partnerProgram} />
        ) : (
          <TransferChip key={portalId} label={cards[0].cardName} cards={cards} bg={recBg} fg={recFg} dashed partnerType={transfer.partnerType} partnerProgram={transfer.partnerProgram} />
        )
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransferRow — transfer partner alternative, styled like PortalRow
// ---------------------------------------------------------------------------

function TransferRow({
  transfer,
  isBest,
  isDark,
  bonus,
  compact,
}: {
  transfer: TransferResult;
  isBest: boolean;
  isDark: boolean;
  bonus?: TransferBonus;
  compact?: boolean;
}) {
  const bonusBadge = bonus && (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wide shrink-0 ${
      isDark ? 'bg-cv-amber-900 text-cv-amber-400' : 'bg-amber-100 text-amber-800'
    }`}>
      +{bonus.bonus_pct}% bonus
    </span>
  );
  const multiplier = bonus ? 1 + bonus.bonus_pct / 100 : 1;
  const displayCpp = transfer.transferCpp !== null
    ? Math.round(transfer.transferCpp * multiplier * 100) / 100
    : null;
  const displayPts = transfer.estimatedPointsNeeded !== null
    ? Math.round(transfer.estimatedPointsNeeded / multiplier)
    : null;
  const tier   = displayCpp !== null ? cppTier(displayCpp) : null;
  const srcCur = pointCurrency(transfer.sourcePortalId);

  const inkCls    = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const mutedCls  = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowBg     = isBest ? (isDark ? 'bg-green-950/25' : 'bg-green-50/80') : (isDark ? 'bg-blue-950/10' : 'bg-blue-50/40');
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';

  const bookBtn = `px-3 py-1.5 rounded text-xs font-bold transition-colors ${
    isBest ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
  }`;

  return (
    <div className={`relative border-b last:border-b-0 ${borderCls} ${rowBg}`}>
      {isBest && <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-green-500" />}
      {!isBest && <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-blue-500" />}

      {/* ── Desktop: grid row ─────────────────────────────────────────── */}
      <div
        className={`${compact ? 'hidden' : 'hidden md:grid'} items-center px-5 py-4 gap-3.5`}
        style={{ gridTemplateColumns: COL }}
      >
        {/* Partner + source portal */}
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : 'bg-blue-500'}`} />
            <span className={`text-sm font-semibold ${inkCls}`}>{transfer.partnerProgram}</span>
            {bonusBadge}
          </div>
          <div className="mt-1 ml-4">
            {isBest ? <BestValuePill isDark={isDark} /> : <TransferPartnerPill isDark={isDark} />}
          </div>
          <TransferCardChips transfer={transfer} tier={tier} isDark={isDark} />
        </div>

        {/* Value */}
        <div>
          {tier && displayCpp !== null ? (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold font-mono tabular-nums ${inkCls}`}>{displayCpp}¢</span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide"
                style={{ background: tier.chipBg, color: tier.chipFg }}
              >
                {tier.label}
              </span>
            </div>
          ) : (
            <span className={`text-xs italic ${mutedCls}`}>—</span>
          )}
        </div>

        {/* Cost to redeem */}
        <div>
          {displayPts !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span className={`text-sm font-semibold font-mono tabular-nums ${inkCls}`}>
                {displayPts.toLocaleString()}
              </span>
              <span className={`text-xs font-medium ${mutedCls}`}>{srcCur}</span>
              <EstMark isDark={isDark} title="Simplified saver award rate — actual pricing varies" />
            </div>
          ) : (
            <span className={`text-xs italic ${mutedCls}`}>check program</span>
          )}
          <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>direct award, no cash option</div>
        </div>

        {/* Pay cash & earn — not applicable for award transfers */}
        <div className={`text-[10px] font-mono italic opacity-50 ${mutedCls}`}>— no earn-back on transfers</div>

        {/* Transfer button */}
        <div className="flex justify-end">
          <button className={bookBtn}>Transfer →</button>
        </div>
      </div>

      {/* ── Mobile: compact card ──────────────────────────────────────── */}
      <div className={`${compact ? '' : 'md:hidden '}px-4 py-3 flex flex-col gap-2`}>
        {/* Row 1: partner + pill + button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isBest ? 'bg-green-500' : 'bg-blue-500'}`} />
            <span className={`text-sm font-semibold truncate ${inkCls}`}>{transfer.partnerProgram}</span>
            {bonusBadge}
            {isBest ? <BestValuePill isDark={isDark} /> : <TransferPartnerPill isDark={isDark} />}
          </div>
          <button className={`shrink-0 ${bookBtn}`}>Transfer →</button>
        </div>

        {/* Row 2: value + redeem + earn */}
        <div className="flex items-center flex-wrap gap-x-5 gap-y-1">
          {tier && displayCpp !== null && (
            <div className="flex items-center gap-1.5">
              <span className={`text-base font-bold font-mono tabular-nums ${inkCls}`}>{displayCpp}¢</span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase"
                style={{ background: tier.chipBg, color: tier.chipFg }}
              >
                {tier.label}
              </span>
            </div>
          )}
          <div className={`text-xs font-mono ${mutedCls}`}>
            {displayPts !== null ? (
              <>
                <span className={`font-semibold tabular-nums ${inkCls}`}>{displayPts.toLocaleString()}</span>{' '}
                {srcCur} <EstMark isDark={isDark} title="Simplified saver award rate — actual pricing varies" />
              </>
            ) : (
              <span className="italic">check program</span>
            )}
            {' '}· direct award, no cash option
          </div>
          <div className={`text-[10px] font-mono italic opacity-50 ${mutedCls}`}>— no earn-back on transfers</div>
        </div>

        <TransferCardChips transfer={transfer} tier={tier} isDark={isDark} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BonusBanner — top-of-card banner when a live transfer bonus applies
// ---------------------------------------------------------------------------

function formatBonusEndDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function BonusBanner({ bonus, isDark }: { bonus: TransferBonus; isDark: boolean }) {
  return (
    <div className={`px-5 py-2 text-[11px] font-semibold font-mono border-b ${
      isDark ? 'bg-cv-amber-900 text-cv-amber-400 border-gph-dark-line' : 'bg-amber-100 text-amber-800 border-gray-200'
    }`}>
      ⚡ +{bonus.bonus_pct}% transfer bonus to {bonus.transfer_partner} from {ISSUER_LOYALTY_NAME[bonus.issuer]} · Ends {formatBonusEndDate(bonus.end_date)}
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
  compact,
}: {
  result: PointsResult;
  collapseAfter?: number;
  itemName?: string;
  itemMeta?: string;
  compact?: boolean;
}) {
  const { isDark } = useTheme();
  const [groupsExpanded, setGroupsExpanded] = useState(false);

  const { data: transferBonuses = [] } = useQuery({
    queryKey: ['offers.transferBonuses'],
    queryFn:  () => trpc.offers.listTransferBonuses.query(),
    staleTime: 15 * 60 * 1000,
  });
  // Server orders by bonus_pct desc, so find() returns the biggest match.
  // Date-window guard: admin sessions bypass the public RLS end_date filter,
  // so re-check here to only badge bonuses currently live on the offers page.
  const now = Date.now();
  const bonusFor = (t: TransferResult): TransferBonus | undefined =>
    transferBonuses.find(
      b =>
        ISSUER_TO_PORTAL[b.issuer] === t.sourcePortalId &&
        b.transfer_partner === t.partnerProgram &&
        new Date(b.end_date).getTime() > now &&
        (!b.start_date || new Date(b.start_date).getTime() <= now),
    );

  // Unified ¢/pt-ranked list — direct-book portals and transfer partners
  // compete on the same axis; a transfer partner can lead the list.
  const rows = rankOptions(result);
  const globalBest = rows[0];

  const limit       = collapseAfter ?? 3;
  const visible     = groupsExpanded ? rows : rows.slice(0, limit);
  const hiddenCount = rows.length - limit;

  const liveBonus = visible
    .map(row => (row.kind === 'transfer' ? bonusFor(row.transfer) : undefined))
    .find(Boolean);

  const containerBg  = isDark ? 'bg-gph-dark-card'    : 'bg-white';
  const borderCls    = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const moreButtonBg = isDark ? 'bg-gph-dark-bg text-gph-dark-muted hover:bg-gph-dark-linesoft' : 'bg-gray-50 text-gray-500 hover:bg-gray-100';

  return (
    <div className={`overflow-hidden ${containerBg}`}>

      {/* ── Live transfer bonus banner */}
      {liveBonus && <BonusBanner bonus={liveBonus} isDark={isDark} />}

      {/* ── Column headers (desktop) */}
      <ColHeaders isDark={isDark} compact={compact} />

      {/* ── Ranked rows — direct-book portals and transfer partners, merged by ¢/pt */}
      {visible.map(row =>
        row.kind === 'portal' ? (
          <PortalRow
            key={row.key}
            group={row.group}
            isBest={row === globalBest}
            isDark={isDark}
            compact={compact}
          />
        ) : (
          <TransferRow
            key={row.key}
            transfer={row.transfer}
            isBest={row === globalBest}
            isDark={isDark}
            bonus={bonusFor(row.transfer)}
            compact={compact}
          />
        ),
      )}

      {/* ── Show more / collapse */}
      {!groupsExpanded && hiddenCount > 0 && (
        <button
          onClick={() => setGroupsExpanded(true)}
          className={`w-full px-5 py-2.5 text-xs font-medium text-center border-t transition-colors ${borderCls} ${moreButtonBg}`}
        >
          Show {hiddenCount} more portal{hiddenCount > 1 ? 's' : ''}
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

      {/* ── Footer */}
      <p className={`px-5 py-2.5 text-[10px] leading-relaxed border-t ${isDark ? 'border-gph-dark-line text-gph-dark-muted' : 'border-gray-200 text-gray-400'}`}>
        <b>Est.</b> = modeled from portal pricing (TPG Nov 2025, AwardWallet Aug 2025); actual prices
        vary by date. <b>Transfer rows</b> use simplified saver award rates and require moving points
        out of your account — no earn-back applies. Chase Sapphire rows show both rates since
        redemption value depends on card-open date — legacy fixed rates are grandfathered until{' '}
        {CHASE_LEGACY_RATE_SUNSET_DATE}.
        {liveBonus && ' Point cost for bonused transfer rows already reflects the live bonus.'}
      </p>
    </div>
  );
}
