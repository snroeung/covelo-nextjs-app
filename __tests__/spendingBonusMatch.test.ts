import { describe, it, expect } from 'vitest';
import { findLiveSpendingBonusForAirline } from '@/lib/points/spendingBonusMatch';
import type { SpendingBonus } from '@/lib/types/offers';

const NOW = new Date('2026-08-18T00:00:00Z').getTime();

function makeBonus(overrides: Partial<SpendingBonus> = {}): SpendingBonus {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    issuer: 'chase',
    merchant_name: 'United Airlines',
    bonus_multiplier: 5,
    bonus_type: 'points_multiplier',
    spending_minimum: null,
    minimum_nights: null,
    description: null,
    tags: [],
    card_ids: [],
    start_date: null,
    end_date: '2026-12-31',
    is_targeted: false,
    limited_time_offer: false,
    source: 'admin',
    status: 'admin',
    source_url: null,
    country: 'US',
    submitted_by: null,
    upvotes: 0,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('findLiveSpendingBonusForAirline', () => {
  it('matches when the merchant name is the exact airline name', () => {
    const bonus = makeBonus({ merchant_name: 'United Airlines' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBe(bonus);
  });

  it('matches when the merchant name is a shorter form of the airline name', () => {
    const bonus = makeBonus({ merchant_name: 'United' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBe(bonus);
  });

  it('matches when the airline name is a shorter form of the merchant name', () => {
    const bonus = makeBonus({ merchant_name: 'United Airlines Vacations' });
    expect(findLiveSpendingBonusForAirline('United', [bonus], NOW)).toBe(bonus);
  });

  it('is case-insensitive', () => {
    const bonus = makeBonus({ merchant_name: 'united airlines' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBe(bonus);
  });

  it('does not match an unrelated merchant', () => {
    const bonus = makeBonus({ merchant_name: 'Amazon.com' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBeUndefined();
  });

  it('matches any airline when the merchant name is a generic travel category', () => {
    const bonus = makeBonus({ merchant_name: 'Travel' });
    expect(findLiveSpendingBonusForAirline('Delta Air Lines', [bonus], NOW)).toBe(bonus);
  });

  it('matches any airline when the merchant name is a generic airline category', () => {
    const bonus = makeBonus({ merchant_name: 'Airlines' });
    expect(findLiveSpendingBonusForAirline('Southwest', [bonus], NOW)).toBe(bonus);
  });

  it('matches any airline when the merchant name is a generic flights category', () => {
    const bonus = makeBonus({ merchant_name: 'Flights' });
    expect(findLiveSpendingBonusForAirline('Southwest', [bonus], NOW)).toBe(bonus);
  });

  it('does not match a generic category unrelated to travel (e.g. Restaurants)', () => {
    const bonus = makeBonus({ merchant_name: 'Restaurants' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBeUndefined();
  });

  it('ignores a bonus whose end_date has already passed', () => {
    const bonus = makeBonus({ merchant_name: 'United Airlines', end_date: '2026-01-01' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBeUndefined();
  });

  it('ignores a bonus that has not started yet', () => {
    const bonus = makeBonus({ merchant_name: 'United Airlines', start_date: '2026-12-01' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBeUndefined();
  });

  it('matches a bonus with no end_date (treated as always live)', () => {
    const bonus = makeBonus({ merchant_name: 'United Airlines', end_date: null });
    expect(findLiveSpendingBonusForAirline('United Airlines', [bonus], NOW)).toBe(bonus);
  });

  it('returns undefined when airlineName is null', () => {
    const bonus = makeBonus({ merchant_name: 'Travel' });
    expect(findLiveSpendingBonusForAirline(null, [bonus], NOW)).toBeUndefined();
  });

  it('returns undefined when no bonuses are given', () => {
    expect(findLiveSpendingBonusForAirline('United Airlines', [], NOW)).toBeUndefined();
  });

  it('returns the first live match among several bonuses', () => {
    const noMatch = makeBonus({ merchant_name: 'Amazon.com' });
    const match = makeBonus({ merchant_name: 'United Airlines' });
    expect(findLiveSpendingBonusForAirline('United Airlines', [noMatch, match], NOW)).toBe(match);
  });
});
