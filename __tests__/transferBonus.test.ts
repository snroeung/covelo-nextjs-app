import { describe, it, expect } from 'vitest';
import { findBonusForTransfer, findLiveBonus } from '@/lib/points/transferBonus';
import type { TransferResult, PointsResult } from '@/lib/points/types';
import type { TransferBonus } from '@/lib/types/offers';

const NOW = new Date('2026-07-28T00:00:00Z').getTime();

function mkTransfer(overrides: Partial<TransferResult> = {}): TransferResult {
  return {
    partnerProgram: 'World of Hyatt',
    partnerType: 'hotel',
    sourceCardId: 'chase_reserve',
    sourcePortalId: 'chase',
    transferRatio: '1:1',
    estimatedPointsNeeded: 1000,
    estimatedCentsPerPoint: 1.5,
    transferCpp: 1.5,
    note: '',
    isBetterThanPortal: true,
    estimated: true,
    eligibleCards: [],
    recommendedCards: [],
    ...overrides,
  };
}

function mkBonus(overrides: Partial<TransferBonus> = {}): TransferBonus {
  return {
    id: 'bonus-1',
    issuer: 'chase',
    transfer_partner: 'World of Hyatt',
    bonus_pct: 30,
    min_transfer_points: null,
    effective_ratio: 1.3,
    description: null,
    tags: [],
    start_date: null,
    end_date: '2026-08-31',
    is_targeted: false,
    for_status_transfer: false,
    limited_time_offer: true,
    source: 'cron',
    status: 'approved',
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

function mkResult(transferAlternatives: TransferResult[]): PointsResult {
  return {
    priceUsd: 100,
    bookingType: 'hotel',
    portalGroups: [],
    portalResults: [],
    bestPortalResult: {
      portalId: 'chase',
      portalName: 'Chase Travel',
      cardId: 'chase_reserve',
      cardName: 'Chase Sapphire Reserve',
      priceUsd: 100,
      pointsNeeded: 1000,
      centsPerPoint: 1.0,
      earnRate: 10,
      pointsEarned: 1000,
      estimated: true,
      bookingType: 'hotel',
    },
    transferAlternatives,
    bestTransferResult: null,
  };
}

describe('findBonusForTransfer()', () => {
  it('1. matches on issuer (via sourcePortalId) + partner, live bonus', () => {
    const t = mkTransfer();
    const bonus = mkBonus();
    expect(findBonusForTransfer(t, [bonus], NOW)).toBe(bonus);
  });

  it('2. no match when partner differs', () => {
    const t = mkTransfer({ partnerProgram: 'Flying Blue' });
    const bonus = mkBonus();
    expect(findBonusForTransfer(t, [bonus], NOW)).toBeUndefined();
  });

  it('3. no match when issuer/portal differs', () => {
    const t = mkTransfer({ sourcePortalId: 'amex' });
    const bonus = mkBonus({ issuer: 'chase' });
    expect(findBonusForTransfer(t, [bonus], NOW)).toBeUndefined();
  });

  it('4. expired bonus (end_date in past) excluded', () => {
    const t = mkTransfer();
    const bonus = mkBonus({ end_date: '2026-01-01' });
    expect(findBonusForTransfer(t, [bonus], NOW)).toBeUndefined();
  });

  it('5. not-yet-started bonus (start_date in future) excluded', () => {
    const t = mkTransfer();
    const bonus = mkBonus({ start_date: '2026-12-01' });
    expect(findBonusForTransfer(t, [bonus], NOW)).toBeUndefined();
  });

  it('6. bonus with no start_date is live as long as end_date is future', () => {
    const t = mkTransfer();
    const bonus = mkBonus({ start_date: null, end_date: '2026-08-01' });
    expect(findBonusForTransfer(t, [bonus], NOW)).toBe(bonus);
  });

  it('7. bonus exactly at end_date boundary (not after now) excluded', () => {
    const t = mkTransfer();
    const bonus = mkBonus({ end_date: '2026-07-28' });
    expect(findBonusForTransfer(t, [bonus], NOW)).toBeUndefined();
  });

  it('8. returns first match when multiple bonuses present (server pre-sorts by bonus_pct desc)', () => {
    const t = mkTransfer();
    const best = mkBonus({ id: 'best', bonus_pct: 50 });
    const worse = mkBonus({ id: 'worse', bonus_pct: 20 });
    expect(findBonusForTransfer(t, [best, worse], NOW)?.id).toBe('best');
  });
});

describe('findLiveBonus()', () => {
  it('9. scans transferAlternatives and returns the first live match', () => {
    const noMatch = mkTransfer({ partnerProgram: 'Flying Blue' });
    const match = mkTransfer({ partnerProgram: 'World of Hyatt' });
    const result = mkResult([noMatch, match]);
    const bonus = mkBonus();
    expect(findLiveBonus(result, [bonus], NOW)).toBe(bonus);
  });

  it('10. returns undefined when no transferAlternatives match any bonus', () => {
    const result = mkResult([mkTransfer({ partnerProgram: 'Flying Blue' })]);
    const bonus = mkBonus({ transfer_partner: 'World of Hyatt' });
    expect(findLiveBonus(result, [bonus], NOW)).toBeUndefined();
  });

  it('11. returns undefined when transferAlternatives is empty', () => {
    const result = mkResult([]);
    expect(findLiveBonus(result, [mkBonus()], NOW)).toBeUndefined();
  });

  it('12. returns undefined when bonuses list is empty', () => {
    const result = mkResult([mkTransfer()]);
    expect(findLiveBonus(result, [], NOW)).toBeUndefined();
  });
});
