import {
  CardId,
  PortalId,
  BookingType,
  PortalResult,
  PortalGroup,
  PointsResult,
  FlightContext,
  PORTAL_CPP,
  CARD_EARN_RATE,
  CARD_PORTAL_MAP,
  CARD_NAMES,
  PORTAL_NAMES,
  CHASE_LEGACY_CPP,
} from './types';
import { calcTransferAlternatives } from './transferPartners';
import { PORTAL_FLIGHT_MARKUP, PORTAL_HOTEL_MARKUP } from './portalMarkup';

const ALL_CARD_IDS = Object.keys(PORTAL_CPP) as CardId[];
const VALID_CARD_IDS = new Set<string>(ALL_CARD_IDS);

function resolveCpp(cardId: CardId, bookingType: BookingType): number {
  const value = PORTAL_CPP[cardId];
  if (typeof value === 'number') return value;
  return value[bookingType];
}

function resolveEarnRate(cardId: CardId, bookingType: BookingType): number {
  const value = CARD_EARN_RATE[cardId];
  if (typeof value === 'number') return value;
  return value[bookingType];
}

export function calcPoints(
  priceUsd: number,
  bookingType: BookingType,
  userCards: CardId[] = ALL_CARD_IDS,
  flightCtx?: FlightContext,
  /**
   * Per-portal price overrides. Swap in real values here once EPS Rapid
   * (Chase/Amex/Bilt/Citi) and Booking.com APIs are integrated.
   * Defaults to priceUsd for any portal not listed.
   */
  portalPrices?: Partial<Record<PortalId, number>>,
): PointsResult {
  if (priceUsd <= 0) throw new Error('priceUsd must be greater than 0');

  const cardPool   = userCards.length === 0 ? ALL_CARD_IDS : userCards;
  const validCards = cardPool.filter((c) => VALID_CARD_IDS.has(c));
  if (validCards.length === 0) throw new Error('userCards must contain at least one valid CardId');

  // Group user's cards by portal
  const cardsByPortal = new Map<PortalId, CardId[]>();
  for (const cardId of validCards) {
    const portalId = CARD_PORTAL_MAP[cardId] as PortalId;
    if (!cardsByPortal.has(portalId)) cardsByPortal.set(portalId, []);
    cardsByPortal.get(portalId)!.push(cardId);
  }

  const portalGroups: PortalGroup[] = [];

  for (const [portalId, cards] of cardsByPortal.entries()) {
    const markup =
      (bookingType === 'flight' ? PORTAL_FLIGHT_MARKUP : PORTAL_HOTEL_MARKUP)[portalId];
    // Overrides are real portal quotes (already marked up); otherwise estimate
    // the portal's price from the base price using the calibrated markup.
    const portalPrice = portalPrices?.[portalId] ?? priceUsd * markup;

    // Chase Points Boost means we don't know which redemption rate applies to
    // a selected chase_reserve/chase_preferred card, so both candidate rates
    // (legacy fixed + new baseline) enter the dedup pool as separate entries.
    type Candidate = { cardId: CardId; cpp: number; rateVariant?: 'legacy' | 'new' };
    const candidates: Candidate[] = [];
    for (const cardId of cards) {
      const legacyCpp = CHASE_LEGACY_CPP[cardId];
      if (legacyCpp !== undefined) {
        candidates.push({ cardId, cpp: legacyCpp, rateVariant: 'legacy' });
        candidates.push({ cardId, cpp: resolveCpp(cardId, bookingType), rateVariant: 'new' });
      } else {
        candidates.push({ cardId, cpp: resolveCpp(cardId, bookingType) });
      }
    }

    // Deduplicate by CPP within this portal — one row per distinct CPP tier.
    // When two candidates share a CPP, keep the one with the higher earn rate.
    const byCpp = new Map<number, Candidate>();
    for (const candidate of candidates) {
      const existing = byCpp.get(candidate.cpp);
      if (!existing || resolveEarnRate(candidate.cardId, bookingType) > resolveEarnRate(existing.cardId, bookingType)) {
        byCpp.set(candidate.cpp, candidate);
      }
    }

    // Sort highest CPP first (best value first within the group)
    const results: PortalResult[] = Array.from(byCpp.entries())
      .sort(([a], [b]) => b - a)
      .map(([cpp, candidate]) => {
        const { cardId, rateVariant } = candidate;
        const earnRate = resolveEarnRate(cardId, bookingType);
        return {
          portalId,
          portalName: PORTAL_NAMES[portalId],
          cardId,
          cardName: CARD_NAMES[cardId],
          priceUsd: portalPrice,
          pointsNeeded: Math.ceil(portalPrice / (cpp / 100)),
          // Effective value: portal charges points on its marked-up price, so
          // each point buys cpp × (true price / portal price) cents of real
          // cash value. Derived from the actual portalPrice so overrides with
          // real quotes stay consistent (= cpp / markup when estimated).
          centsPerPoint: Math.round(cpp * (priceUsd / portalPrice) * 100) / 100,
          earnRate,
          pointsEarned: Math.floor(portalPrice * earnRate),
          estimated: true as const,
          bookingType,
          chaseRateVariant: rateVariant,
        };
      });

    portalGroups.push({ portalId, portalName: PORTAL_NAMES[portalId], priceUsd: portalPrice, results });
  }

  // Sort groups by their best result (fewest points needed)
  portalGroups.sort((a, b) => a.results[0].pointsNeeded - b.results[0].pointsNeeded);

  // Flat best-per-portal list (top result from each group) for transfer comparison
  const portalResults: PortalResult[] = portalGroups.map((g) => g.results[0]);
  const bestPortalResult = portalResults[0];

  // Always evaluate transfers across all portals so card selection doesn't hide
  // programs that beat the user's best portal.
  const transferAlternatives = calcTransferAlternatives(
    priceUsd,
    bookingType,
    ALL_CARD_IDS,
    bestPortalResult,
    undefined,
    undefined,
    flightCtx,
  );

  const betterTransfers  = transferAlternatives.filter((t) => t.isBetterThanPortal);
  const bestTransferResult = betterTransfers.length > 0 ? betterTransfers[0] : null;

  return {
    priceUsd,
    bookingType,
    portalGroups,
    portalResults,
    bestPortalResult,
    transferAlternatives,
    bestTransferResult,
  };
}
