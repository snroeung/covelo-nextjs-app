import { describe, expect, it } from 'vitest';
import { isLiveOffer, liveOfferFilter, liveOffers, todayIso } from '@/lib/offers/live';

const NOON = new Date('2026-10-27T12:00:00Z');

describe('isLiveOffer', () => {
  it('is live through its end date: "ends today" still shows, the day after it does not', () => {
    expect(isLiveOffer({ end_date: '2026-10-27' }, NOON)).toBe(true);
    expect(isLiveOffer({ end_date: '2026-10-28' }, NOON)).toBe(true);
    expect(isLiveOffer({ end_date: '2026-10-26' }, NOON)).toBe(false);
  });

  it('treats no end date as ongoing, and a switched-off offer as not live', () => {
    expect(isLiveOffer({ end_date: null }, NOON)).toBe(true);
    expect(isLiveOffer({ end_date: '2099-01-01', active: false }, NOON)).toBe(false);
    expect(isLiveOffer({ end_date: '2099-01-01', active: true }, NOON)).toBe(true);
  });

  it('reads a timestamp-shaped end date by its day', () => {
    expect(isLiveOffer({ end_date: '2026-10-27T00:00:00+00:00' }, NOON)).toBe(true);
    expect(isLiveOffer({ end_date: '2026-10-26T23:59:59+00:00' }, NOON)).toBe(false);
  });
});

describe('liveOffers / liveOfferFilter / todayIso', () => {
  it('keeps order and drops what has ended', () => {
    const rows = [{ id: 'a', end_date: '2026-10-30' }, { id: 'b', end_date: '2026-10-01' }, { id: 'c', end_date: null }];
    expect(liveOffers(rows, NOON).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('builds the matching database filter', () => {
    expect(todayIso(NOON)).toBe('2026-10-27');
    expect(liveOfferFilter(NOON)).toBe('end_date.is.null,end_date.gte.2026-10-27');
  });
});
