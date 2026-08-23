import type { SpendingBonus } from '@/lib/types/offers';

// Spending bonuses use one free-text field for either a specific merchant
// ("United Airlines") or a spending category ("Travel", "Airlines") — see
// AdminOfferEditor's "MERCHANT / CATEGORY" field. A category bonus applies to
// every flight regardless of airline; a merchant bonus only applies when it
// names this flight's airline.
const GENERIC_TRAVEL_KEYWORDS = ['travel', 'airline', 'flight'];

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function merchantMatchesAirline(merchant: string, airlineName: string): boolean {
  const normMerchant = normalizeForMatch(merchant);
  if (!normMerchant) return false;
  if (GENERIC_TRAVEL_KEYWORDS.some((kw) => normMerchant.includes(kw))) return true;

  const normAirline = normalizeForMatch(airlineName);
  if (!normAirline) return false;
  return normAirline.includes(normMerchant) || normMerchant.includes(normAirline);
}

/**
 * The live (date-window-checked) spending bonus that applies to a flight's
 * airline — issuer-agnostic and not gated on card ownership, matching how
 * CollectionBanner/TransferBonusBanner already surface live promos regardless
 * of which specific card the offer would be booked with.
 */
export function findLiveSpendingBonusForAirline(
  airlineName: string | null,
  bonuses: SpendingBonus[],
  now: number,
): SpendingBonus | undefined {
  if (!airlineName) return undefined;
  return bonuses.find((b) => {
    if (b.end_date && new Date(b.end_date).getTime() <= now) return false;
    if (b.start_date && new Date(b.start_date).getTime() > now) return false;
    return merchantMatchesAirline(b.merchant_name, airlineName);
  });
}
