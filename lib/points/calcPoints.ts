import {
  CardId,
  BookingType,
  PortalResult,
  PointsResult,
  PORTAL_CPP,
  CARD_EARN_RATE,
  CARD_PORTAL_MAP,
  CARD_NAMES,
  PORTAL_NAMES,
} from './types';
import { calcTransferAlternatives } from './transferPartners';

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
): PointsResult {
  if (priceUsd <= 0) throw new Error('priceUsd must be greater than 0');

  // Empty userCards defaults to all available cards
  const cardPool = userCards.length === 0 ? ALL_CARD_IDS : userCards;
  const validCards = cardPool.filter((c) => VALID_CARD_IDS.has(c));
  if (validCards.length === 0) throw new Error('userCards must contain at least one valid CardId');

  // Group by portal, keep the card with the highest CPP (fewest points) per portal
  const bestByPortal = new Map<string, { cardId: CardId; cpp: number }>();
  for (const cardId of validCards) {
    const portalId = CARD_PORTAL_MAP[cardId];
    const cpp = resolveCpp(cardId, bookingType);
    const existing = bestByPortal.get(portalId);
    if (!existing || cpp > existing.cpp) {
      bestByPortal.set(portalId, { cardId, cpp });
    }
  }

  const portalResults: PortalResult[] = Array.from(bestByPortal.entries()).map(
    ([portalId, { cardId, cpp }]) => {
      const earnRate = resolveEarnRate(cardId, bookingType);
      return {
        portalId: portalId as PortalResult['portalId'],
        portalName: PORTAL_NAMES[portalId as PortalResult['portalId']],
        cardId,
        cardName: CARD_NAMES[cardId],
        pointsNeeded: Math.ceil(priceUsd / (cpp / 100)),
        centsPerPoint: cpp,
        earnRate,
        pointsEarned: Math.floor(priceUsd * earnRate),
        estimated: true as const,
        bookingType,
      };
    }
  );

  portalResults.sort((a, b) => a.pointsNeeded - b.pointsNeeded);

  const bestPortalResult = portalResults[0];

  const transferAlternatives = calcTransferAlternatives(
    priceUsd,
    bookingType,
    validCards,
    bestPortalResult
  );

  const betterTransfers = transferAlternatives.filter((t) => t.isBetterThanPortal);
  const bestTransferResult = betterTransfers.length > 0 ? betterTransfers[0] : null;

  return {
    priceUsd,
    bookingType,
    portalResults,
    bestPortalResult,
    transferAlternatives,
    bestTransferResult,
  };
}
