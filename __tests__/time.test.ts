import { describe, expect, it } from 'vitest';
import { dateInZone, zoneOrUtc, isValidTimeZone } from '@/lib/time';
import { isLiveOffer, liveOffers, widestLiveOfferFilter } from '@/lib/offers/live';

// 2026-12-31 20:00 in Los Angeles (UTC-8) is already 2027-01-01 04:00 UTC and 2027-01-01 13:00 in Tokyo
const INSTANT = new Date('2027-01-01T04:00:00Z');

describe('dateInZone', () => {
  it('reads the same instant as a different calendar day per zone', () => {
    expect(dateInZone(INSTANT, 'UTC')).toBe('2027-01-01');
    expect(dateInZone(INSTANT, 'America/Los_Angeles')).toBe('2026-12-31');
    expect(dateInZone(INSTANT, 'Asia/Tokyo')).toBe('2027-01-01');
  });
  it('defaults to UTC and survives a bad zone', () => {
    expect(dateInZone(INSTANT)).toBe('2027-01-01');
    expect(dateInZone(INSTANT, 'Not/AZone')).toBe('2027-01-01');
  });
});

describe('zoneOrUtc', () => {
  it('accepts IANA zones and falls back to UTC for anything else', () => {
    expect(zoneOrUtc('America/New_York')).toBe('America/New_York');
    expect(zoneOrUtc('nonsense')).toBe('UTC');
    expect(zoneOrUtc('')).toBe('UTC');
    expect(zoneOrUtc(null)).toBe('UTC');
    expect(isValidTimeZone('Europe/London')).toBe(true);
  });
});

describe('offer expiry follows the viewer zone', () => {
  const offer = { end_date: '2026-12-31' };
  it('an offer ending Dec 31 is still live that evening in LA but over in UTC and Tokyo', () => {
    expect(isLiveOffer(offer, INSTANT, 'America/Los_Angeles')).toBe(true);
    expect(isLiveOffer(offer, INSTANT, 'UTC')).toBe(false);
    expect(isLiveOffer(offer, INSTANT, 'Asia/Tokyo')).toBe(false);
  });
  it('liveOffers trims per zone', () => {
    expect(liveOffers([offer], INSTANT, 'America/Los_Angeles')).toHaveLength(1);
    expect(liveOffers([offer], INSTANT)).toHaveLength(0);
  });
  it('the shared query filter keeps whatever is live in any zone', () => {
    // UTC-12 is still on 2026-12-31 at this instant
    expect(widestLiveOfferFilter(INSTANT)).toBe('end_date.is.null,end_date.gte.2026-12-31');
  });
});
