export type RouteType = 'domestic' | 'short_haul' | 'long_haul';
export type Cabin = 'economy' | 'business' | 'first';

export interface FlightContext {
  airlineIata?: string | null;
  originIata?: string | null;
  destIata?: string | null;
  routeType?: RouteType;
  cabin?: Cabin;
}

export type CardId =
  | 'chase_reserve'
  | 'chase_preferred'
  | 'chase_freedom_unlimited'
  | 'c1_venture_x'
  | 'c1_venture'
  | 'c1_savor'
  | 'amex_platinum'
  | 'amex_gold'
  | 'amex_green'
  | 'bilt'
  | 'citi_strata_premier'
  | 'citi_strata_elite';

export type PortalId =
  | 'chase'
  | 'amex'
  | 'capital_one'
  | 'bilt'
  | 'citi';

export type BookingType = 'hotel' | 'flight';

export interface PortalResult {
  portalId: PortalId;
  portalName: string;
  cardId: CardId;
  cardName: string;
  /** Price this result is calculated against (portal-specific; currently all Duffel) */
  priceUsd: number;
  /** Points needed to book using points through this card's portal */
  pointsNeeded: number;
  centsPerPoint: number;
  /** Points earned if paying cash through this card's portal */
  earnRate: number;
  pointsEarned: number;
  estimated: true;
  bookingType: BookingType;
}

/**
 * All cards for one issuer portal, grouped under the portal's price.
 * Cards are deduplicated by CPP — only one row per distinct CPP tier.
 * When EPS Rapid / Booking.com APIs are added, priceUsd will differ per portal.
 */
export interface PortalGroup {
  portalId: PortalId;
  portalName: string;
  /** Price sourced from this portal's API (currently all Duffel → same value) */
  priceUsd: number;
  /** Unique-CPP card results, sorted best (highest CPP) first */
  results: PortalResult[];
}

export interface TransferResult {
  partnerProgram: string;
  partnerType: 'hotel' | 'airline';
  sourceCardId: CardId;
  sourcePortalId: PortalId;
  transferRatio: string;
  estimatedPointsNeeded: number | null;
  estimatedCentsPerPoint: number | null;
  /** Effective CPP when transferring, based on flight price vs award cost */
  transferCpp: number | null;
  note: string;
  isBetterThanPortal: boolean;
  estimated: true;
  routeType?: RouteType;
  cabin?: Cabin;
}

export interface PointsResult {
  /** Baseline price (used for transfer comparisons; equals priceUsd when all portals share one API) */
  priceUsd: number;
  bookingType: BookingType;
  /** Portals grouped by issuer, each with their own price and deduplicated CPP rows */
  portalGroups: PortalGroup[];
  /** Flat best-per-portal list (for transfer comparison logic) */
  portalResults: PortalResult[];
  bestPortalResult: PortalResult;
  transferAlternatives: TransferResult[];
  bestTransferResult: TransferResult | null;
}

/**
 * Cents per point when redeeming through each card's travel portal.
 * Higher = more value per point = fewer points needed.
 * Source: published portal redemption values (as of 2025).
 */
export const PORTAL_CPP: Record<CardId, number | { hotel: number; flight: number }> = {
  chase_reserve:           1.5,   // 50% travel portal bonus
  chase_preferred:         1.25,  // 25% travel portal bonus
  chase_freedom_unlimited: 1.0,   // no portal bonus
  c1_venture_x:            1.0,   // 1¢/mile fixed
  c1_venture:              1.0,
  c1_savor:                1.0,
  amex_platinum:           { hotel: 0.7, flight: 1.0 },
  amex_gold:               { hotel: 0.7, flight: 1.0 },
  amex_green:              { hotel: 0.7, flight: 1.0 },
  bilt:                    1.25,  // 1.25¢/pt in Bilt Travel
  citi_strata_premier:     1.0,
  citi_strata_elite:       1.0,
};

/**
 * Points earned per dollar spent when paying cash through the card's travel portal.
 * These are the portal-specific bonus earn rates (e.g. Chase Travel 5x flights).
 * Source: published card benefits (as of 2025).
 */
export const CARD_EARN_RATE: Record<CardId, number | { hotel: number; flight: number }> = {
  chase_reserve:           { hotel: 10, flight: 5 },  // 10x hotels, 5x flights via Chase Travel
  chase_preferred:         { hotel: 5,  flight: 3 },  // 5x hotels, 3x flights via Chase Travel
  chase_freedom_unlimited: { hotel: 5,  flight: 3 },  // 5x hotels, 3x flights via Chase Travel
  c1_venture_x:            { hotel: 10, flight: 5 },  // 10x hotels, 5x flights via C1 Travel
  c1_venture:              { hotel: 5,  flight: 5 },  // 5x hotels + flights via C1 Travel
  c1_savor:                1,                          // 1x on travel (dining card)
  amex_platinum:           { hotel: 1,  flight: 5 },  // 5x flights (direct/Amex Travel), 1x hotels
  amex_gold:               { hotel: 2,  flight: 3 },  // 3x flights, ~2x hotels via Amex Travel
  amex_green:              3,                          // 3x travel & transit
  bilt:                    2,                          // 2x travel via Bilt Travel
  citi_strata_premier:     3,                          // 3x air/hotel
  citi_strata_elite:       4,                          // 4x air/hotel (premium tier)
};

export const CARD_PORTAL_MAP: Record<CardId, PortalId> = {
  chase_reserve:           'chase',
  chase_preferred:         'chase',
  chase_freedom_unlimited: 'chase',
  c1_venture_x:            'capital_one',
  c1_venture:              'capital_one',
  c1_savor:                'capital_one',
  amex_platinum:           'amex',
  amex_gold:               'amex',
  amex_green:              'amex',
  bilt:                    'bilt',
  citi_strata_premier:     'citi',
  citi_strata_elite:       'citi',
};

export const CARD_NAMES: Record<CardId, string> = {
  chase_reserve:           'Chase Sapphire Reserve',
  chase_preferred:         'Chase Sapphire Preferred',
  chase_freedom_unlimited: 'Chase Freedom Unlimited',
  c1_venture_x:            'Capital One Venture X',
  c1_venture:              'Capital One Venture',
  c1_savor:                'Capital One Savor',
  amex_platinum:           'Amex Platinum',
  amex_gold:               'Amex Gold',
  amex_green:              'Amex Green',
  bilt:                    'Bilt Mastercard',
  citi_strata_premier:     'Citi Strata Premier',
  citi_strata_elite:       'Citi Strata Elite',
};

export const PORTAL_NAMES: Record<PortalId, string> = {
  chase:       'Chase Travel',
  amex:        'Amex Travel',
  capital_one: 'Capital One Travel',
  bilt:        'Bilt Travel',
  citi:        'Citi Travel',
};
