import type { PointsResult, PortalGroup, PortalId, TransferResult } from './types';
import { ISSUER_LOYALTY_NAME } from './transferBonus';
import type { RankedOption } from './rankOptions';
import type { TransferBonus } from '@/lib/types/offers';

/**
 * Presentation-ready view of a single ranked booking option.
 *
 * PortalRow and TransferRow used to duplicate every derivation (bonus math,
 * currency noun, cash-earn copy) inline in JSX. The comparison card design
 * renders the same option in three places — featured row, popover row, and the
 * card's summary header — so the derivations live here instead, keeping the
 * numbers identical across all three and unit-testable without a DOM.
 */
export interface OptionRowView {
  key: string;
  kind: 'portal' | 'transfer';
  /** Chase Travel / Flying Blue — the bare program, used for aria labels */
  sourceName: string;
  /** Row headline — "Chase Travel" / "Flying Blue via American Express" */
  displayName: string;
  /**
   * Booking context under the headline — transfer ratio and any applied promo.
   * Null for direct-book portals, where the headline already says everything.
   */
  context: string | null;
  /** Portal the points come out of — drives the colour mark and cash-earn copy */
  sourcePortalId: PortalId;
  /** Bonus-adjusted cents per point; null when the program publishes no rate */
  cpp: number | null;
  /** Bonus-adjusted points required; null when the program publishes no rate */
  points: number | null;
  /** 'pts' or 'mi' — Capital One denominates in miles */
  pointsUnit: string;
  /** Cash price for the same booking; null for transfer rows (award-only) */
  cashUsd: number | null;
  /**
   * What the traveller earns instead by paying cash on this portal. Portal rows
   * only — a transfer row is an award booking on the partner, so "pay cash"
   * isn't an alternative to it, it's a different booking entirely.
   */
  earn: { rate: number; points: number; program: string; cashUsd: number } | null;
  /** Set only when no owned card reaches a transfer partner — the option is unbookable as-is */
  unlockNote: string | null;
  /** Live transfer bonus already folded into cpp/points, for badging */
  bonus?: TransferBonus;
  /** Tooltip for the "est." mark — transfer rows carry a stronger caveat */
  estNote: string;
}

/** Issuer brand, not portal brand — "Flying Blue via American Express". */
export const ISSUER_BRAND: Record<PortalId, string> = {
  chase: 'Chase',
  amex:  'American Express',
  c1:    'Capital One',
  bilt:  'Bilt',
  citi:  'Citi',
};

/** Capital One denominates its currency in miles; everyone else in points. */
export function pointCurrency(portalId: PortalId): string {
  return portalId === 'c1' ? 'mi' : 'pts';
}

const PORTAL_ESTIMATE_NOTE = 'Estimated from recent portal pricing';
const TRANSFER_ESTIMATE_NOTE = 'Simplified saver award rate — actual pricing varies';

function earnFor(group: PortalGroup | undefined): OptionRowView['earn'] {
  const best = group?.results[0];
  if (!best || best.pointsEarned <= 0) return null;
  return {
    rate: best.earnRate,
    points: best.pointsEarned,
    program: ISSUER_LOYALTY_NAME[group!.portalId],
    cashUsd: group!.priceUsd,
  };
}

function portalView(group: PortalGroup): OptionRowView {
  const best = group.results[0];
  return {
    key: group.portalId,
    kind: 'portal',
    sourceName: group.portalName,
    displayName: group.portalName,
    context: null,
    sourcePortalId: group.portalId,
    cpp: best.centsPerPoint,
    points: best.pointsNeeded,
    pointsUnit: pointCurrency(group.portalId),
    cashUsd: group.priceUsd,
    earn: earnFor(group),
    unlockNote: null,
    estNote: PORTAL_ESTIMATE_NOTE,
  };
}

/**
 * A transfer partner none of the selected cards can reach isn't bookable as
 * listed — say which card would unlock it rather than showing a rate the user
 * can't act on.
 */
function unlockNoteFor(transfer: TransferResult): string | null {
  if ((transfer.eligibleCards ?? []).length > 0) return null;
  const rec = transfer.recommendedCards ?? [];
  return rec.length > 0 ? `Not in your wallet — ${rec[0].cardName} would unlock it` : null;
}

function transferView(
  key: string,
  transfer: TransferResult,
  result: PointsResult,
  bonus?: TransferBonus,
): OptionRowView {
  // A bonus multiplies what each source point is worth, so cpp scales up and
  // the points required scale down by the same factor.
  const multiplier = bonus?.bonus_pct != null ? 1 + bonus.bonus_pct / 100 : 1;
  const cpp = transfer.transferCpp !== null
    ? Math.round(transfer.transferCpp * multiplier * 100) / 100
    : null;
  const points = transfer.estimatedPointsNeeded !== null
    ? Math.round(transfer.estimatedPointsNeeded / multiplier)
    : null;

  const bonusNote = bonus?.bonus_pct != null
    ? ` · ${bonus.bonus_pct}% bonus applied`
    : bonus
      ? ' · status match applied'
      : '';

  return {
    key,
    kind: 'transfer',
    sourceName: transfer.partnerProgram,
    displayName: `${transfer.partnerProgram} via ${ISSUER_BRAND[transfer.sourcePortalId]}`,
    context: `${transfer.transferRatio} transfer${bonusNote}`,
    sourcePortalId: transfer.sourcePortalId,
    cpp,
    points,
    pointsUnit: pointCurrency(transfer.sourcePortalId),
    // Award transfers move points out of the account — there is no cash rate
    // on the partner side to fall back to, and no earn-back either.
    cashUsd: null,
    earn: null,
    unlockNote: unlockNoteFor(transfer),
    bonus,
    estNote: TRANSFER_ESTIMATE_NOTE,
  };
}

export function buildRowView(
  row: RankedOption,
  result: PointsResult,
  bonus?: TransferBonus,
): OptionRowView {
  return row.kind === 'portal'
    ? portalView(row.group)
    : transferView(row.key, row.transfer, result, bonus);
}

/**
 * The card shows exactly two options up front: the best direct-book portal and
 * the best transfer partner. Picking one of each — rather than the top two by
 * ¢/pt — keeps the two genuinely different ways to book side by side instead of
 * burying the transfer route behind two near-identical portal rows.
 *
 * `views` must already be ranked best-first; the returned pair keeps that order.
 */
export function splitFeatured(views: OptionRowView[]): {
  featured: OptionRowView[];
  alternatives: OptionRowView[];
} {
  const featuredKeys = new Set(
    [views.find(v => v.kind === 'portal'), views.find(v => v.kind === 'transfer')]
      .filter((v): v is OptionRowView => v != null)
      .map(v => v.key),
  );
  return {
    featured: views.filter(v => featuredKeys.has(v.key)),
    alternatives: views.filter(v => !featuredKeys.has(v.key)),
  };
}

/** "Pay $903 cash: earn 5× Chase Ultimate Rewards · est. 3,215 pts" */
export function cashEarnLine(view: OptionRowView): string | null {
  if (!view.earn) return null;
  const price = view.earn.cashUsd.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
  return `Pay ${price} cash: earn ${view.earn.rate}× ${view.earn.program} · est. ${view.earn.points.toLocaleString()} ${view.pointsUnit}`;
}
