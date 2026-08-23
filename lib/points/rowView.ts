import type {
  PointsResult, PortalGroup, PortalId, TransferResult, TransferSourceCard, TransferSourceIssuer,
} from './types';
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
/**
 * One chip under a transfer row.
 *
 * A card the user owns gets its own chip, because the rate is written per card —
 * two cards from one issuer can reach the same program at different ratios. An
 * issuer they don't own collapses to a single chip advertising its best rate,
 * with the per-card breakdown behind `ratioDetail`; listing every card of every
 * issuer they don't hold would bury the ones they do.
 */
export interface SourceCardView {
  /** Stable key — card id for owned chips, portal id for issuer chips */
  key: string;
  portalId: PortalId;
  /** Card name for an owned chip, issuer brand for an issuer chip */
  label: string;
  /** Short ratio form — "1:1", "4:3", "1:1.2" */
  ratioLabel: string;
  /** Full ratio text plus, for issuer chips, each card's own rate */
  ratioDetail: string;
  /** ¢/pt at this chip's own ratio; null when the program publishes no rate */
  cpp: number | null;
  /** The user holds this card (or, for an issuer chip, any card on it) */
  owned: boolean;
  /** This chip's issuer is the one running the live bonus */
  hasBonus: boolean;
}

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
  /**
   * Every route into this partner, owned cards first then unowned issuers.
   * Ownership lives on each chip rather than on the row, so a wallet holding
   * some but not all of a merged partner's issuers renders honestly.
   */
  sourceCards: SourceCardView[];
  /**
   * Why the recommendation narrowed to one owned card — a live bonus on that
   * issuer, or a better ratio than the user's other cards. Null when the owned
   * routes are interchangeable. Unowned chips stay visible either way.
   */
  sourceNarrowing: 'bonus' | 'ratio' | null;
  /** Live transfer bonus already folded into cpp/points, for badging */
  bonus?: TransferBonus;
  /** Tooltip for the "est." mark — transfer rows carry a stronger caveat */
  estNote: string;
  /**
   * True on whichever of the two featured rows is actually the better deal —
   * the portal row when no transfer beats it, or the transfer row when
   * `TransferResult.isBetterThanPortal` says it does. Kind alone ("portal" vs
   * "transfer") doesn't tell you which one to highlight: a transfer can win.
   */
  isBestChoice: boolean;
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

function portalView(group: PortalGroup): Omit<OptionRowView, 'isBestChoice'> {
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
    // Direct-book rows have one source by definition: the portal itself.
    sourceCards: [],
    sourceNarrowing: null,
    estNote: PORTAL_ESTIMATE_NOTE,
  };
}

/**
 * A partner no owned card reaches isn't bookable as listed — say so rather than
 * showing a rate the user can't act on. The issuers that would unlock it are the
 * chips underneath.
 */
function unlockNoteFor(issuers: TransferSourceIssuer[]): string | null {
  if (issuers.length === 0 || issuers.some(i => i.owned)) return null;
  return issuers.length === 1
    ? `Not in your wallet — ${ISSUER_BRAND[issuers[0].portalId]} would unlock it`
    : 'Not in your wallet — any of these issuers would unlock it';
}

/**
 * Which owned card the row recommends, and what settled it.
 *
 * A bonus beats a ratio: it is time-boxed and issuer-specific, so if an owned
 * issuer has a live promo to this partner, that is where to transfer from today.
 * Failing that a better ratio wins. When the owned routes tie, the row names no
 * winner and says how many cards are interchangeable.
 */
function pickRecommendation(
  owned: TransferSourceIssuer[],
  bonusPortalId?: PortalId,
): { card: TransferSourceCard; portalId: PortalId; narrowing: OptionRowView['sourceNarrowing'] } | null {
  if (owned.length === 0) return null;

  const bonusIssuer = bonusPortalId ? owned.find(i => i.portalId === bonusPortalId) : undefined;
  if (bonusIssuer) return { card: bonusIssuer.best, portalId: bonusIssuer.portalId, narrowing: 'bonus' };

  const ownedCards = owned.flatMap(i => i.cards.map(card => ({ card, portalId: i.portalId })));
  const bestRate = Math.max(...ownedCards.map(c => c.card.multiplier));
  const atBestRate = ownedCards.filter(c => c.card.multiplier === bestRate);
  return {
    ...atBestRate[0],
    narrowing: atBestRate.length < ownedCards.length ? 'ratio' : null,
  };
}

/** "Chase Sapphire Reserve 1:1 · Chase Sapphire Preferred 4:3" — the hover breakdown. */
function issuerRatioDetail(issuer: TransferSourceIssuer): string {
  const perCard = issuer.cards.map(c => `${c.cardName} ${c.ratioLabel}`).join(' · ');
  return issuer.cards.length > 1 ? perCard : issuer.ratio;
}

function transferView(
  key: string,
  transfer: TransferResult,
  result: PointsResult,
  bonus?: TransferBonus,
  bonusPortalId?: PortalId,
): Omit<OptionRowView, 'isBestChoice'> {
  const issuers = transfer.sourceIssuers ?? [];
  const owned = issuers.filter(i => i.owned);
  const recommended = pickRecommendation(owned, bonus ? bonusPortalId : undefined);

  // The row speaks for the recommended card when there is one, otherwise for the
  // best-ranked issuer — which is the one the engine already priced.
  const portalId = recommended?.portalId ?? issuers[0]?.portalId ?? transfer.sourcePortalId;
  const leadIssuer = issuers.find(i => i.portalId === portalId);
  const leadCard = recommended?.card ?? leadIssuer?.best;
  const bonusFactor = bonus?.bonus_pct != null ? 1 + bonus.bonus_pct / 100 : 1;

  /** Partner-side rate restated in this card's points, bonus applied where it belongs. */
  const rateFor = (multiplier: number, withBonus: boolean): number | null =>
    transfer.partnerCpp === null
      ? null
      : Math.round(transfer.partnerCpp * multiplier * (withBonus ? bonusFactor : 1) * 100) / 100;

  // The promo lifts the row when it sits on the issuer the row speaks for. An
  // unscoped bonus (no issuer resolved) still applies — that is the legacy
  // caller shape, and dropping it would silently understate the rate.
  const rowGetsBonus = bonus != null && (bonusPortalId === undefined || portalId === bonusPortalId);
  const cpp = leadCard
    ? rateFor(leadCard.multiplier, rowGetsBonus)
    : transfer.transferCpp === null
      ? null
      : Math.round(transfer.transferCpp * (rowGetsBonus ? bonusFactor : 1) * 100) / 100;
  const points = cpp !== null && cpp > 0 ? Math.ceil((result.priceUsd / cpp) * 100) : null;

  const bonusNote = bonus?.bonus_pct != null
    ? ` · ${bonus.bonus_pct}% bonus applied`
    : bonus
      ? ' · status match applied'
      : '';

  // Owned cards chip individually — their ratios can differ inside one issuer.
  // Issuers the user lacks collapse to one chip at their best available rate.
  const sourceCards: SourceCardView[] = issuers.flatMap((issuer): SourceCardView[] =>
    issuer.owned
      ? issuer.cards.map(card => ({
          key: card.cardId,
          portalId: issuer.portalId,
          label: card.cardName,
          ratioLabel: card.ratioLabel,
          ratioDetail: issuer.ratio,
          cpp: rateFor(card.multiplier, issuer.portalId === bonusPortalId),
          owned: true,
          hasBonus: bonus != null && issuer.portalId === bonusPortalId,
        }))
      : [{
          key: issuer.portalId,
          portalId: issuer.portalId,
          label: ISSUER_BRAND[issuer.portalId],
          ratioLabel: issuer.best.ratioLabel,
          ratioDetail: issuerRatioDetail(issuer),
          cpp: rateFor(issuer.best.multiplier, false),
          owned: false,
          hasBonus: false,
        }],
  );

  // Naming one issuer when several owned cards tie would crown a winner that
  // isn't one; naming none when the user owns nothing would hide the route.
  const ownedChips = sourceCards.filter(c => c.owned);
  const viaLabel = recommended === null
    ? ISSUER_BRAND[portalId]
    : recommended.narrowing === null && ownedChips.length > 1
      ? `${ownedChips.length} cards`
      : ISSUER_BRAND[portalId];

  return {
    key,
    kind: 'transfer',
    sourceName: transfer.partnerProgram,
    displayName: `${transfer.partnerProgram} via ${viaLabel}`,
    context: `${leadCard?.ratioLabel ?? transfer.transferRatio} transfer${bonusNote}`,
    sourcePortalId: portalId,
    cpp,
    points,
    pointsUnit: pointCurrency(portalId),
    // Award transfers move points out of the account — there is no cash rate
    // on the partner side to fall back to, and no earn-back either.
    cashUsd: null,
    earn: null,
    unlockNote: unlockNoteFor(issuers),
    sourceCards,
    sourceNarrowing: recommended?.narrowing ?? null,
    bonus,
    estNote: TRANSFER_ESTIMATE_NOTE,
  };
}

export function buildRowView(
  row: RankedOption,
  result: PointsResult,
  bonus?: TransferBonus,
  /** The owned issuer the bonus belongs to — see findBonusForEligibleCards */
  bonusPortalId?: PortalId,
): OptionRowView {
  const view = row.kind === 'portal'
    ? portalView(row.group)
    : transferView(row.key, row.transfer, result, bonus, bonusPortalId);
  return {
    ...view,
    // Transfer rows carry their own answer; the portal row is the best choice
    // exactly when no transfer alternative beats it. Checked directly against
    // the array rather than result.bestTransferResult so this holds regardless
    // of how that field was derived by the caller.
    isBestChoice: row.kind === 'transfer'
      ? row.transfer.isBetterThanPortal
      : !result.transferAlternatives.some(t => t.isBetterThanPortal),
  };
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
