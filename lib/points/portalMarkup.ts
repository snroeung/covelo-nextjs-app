import { PortalId } from './types';

/**
 * Portal-charged price vs. true cash price, per booking type.
 * Source: TPG Nov 2025 (804 data points, 134 round-trip itineraries; confirmed June 2026)
 * and AwardWallet Aug 2025 (4 properties, 5 portals, 4 booking windows — directional, lower confidence).
 */
export const PORTAL_FLIGHT_MARKUP: Record<PortalId, number> = {
  c1:    1.0076,
  chase: 1.0594,
  bilt:  1.0650,
  amex:  1.1032,
  citi:  1.1459,
};

export const PORTAL_HOTEL_MARKUP: Record<PortalId, number> = {
  c1:    1.0080,
  chase: 1.0600,
  bilt:  1.0700,
  amex:  1.1000,
  citi:  1.1500,
};
