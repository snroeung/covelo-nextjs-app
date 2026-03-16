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
  pointsNeeded: number;
  centsPerPoint: number;
  estimated: true;
  bookingType: BookingType;
}

export interface TransferResult {
  partnerProgram: string;
  partnerType: 'hotel' | 'airline';
  sourceCardId: CardId;
  sourcePortalId: PortalId;
  transferRatio: string;
  estimatedPointsNeeded: number | null;
  estimatedCentsPerPoint: number | null;
  note: string;
  isBetterThanPortal: boolean;
  estimated: true;
}

export interface PointsResult {
  priceUsd: number;
  bookingType: BookingType;
  portalResults: PortalResult[];
  bestPortalResult: PortalResult;
  transferAlternatives: TransferResult[];
  bestTransferResult: TransferResult | null;
}

export const PORTAL_CPP: Record<CardId, number | { hotel: number; flight: number }> = {
  chase_reserve:           1.5,
  chase_preferred:         1.25,
  chase_freedom_unlimited: 1.0,
  c1_venture_x:            1.0,
  c1_venture:              1.0,
  c1_savor:                1.0,
  amex_platinum:           { hotel: 0.7, flight: 1.0 },
  amex_gold:               { hotel: 0.7, flight: 1.0 },
  amex_green:              { hotel: 0.7, flight: 1.0 },
  bilt:                    1.25,
  citi_strata_premier:     1.0,
  citi_strata_elite:       1.0,
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
