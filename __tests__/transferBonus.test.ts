import { describe, it, expect } from 'vitest';
import { findBonusForTransfer, findBonusForEligibleCards, findLiveBonus, matchesTripDates } from '@/lib/points/transferBonus';
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
    partnerCpp: 1.5,
    sourceIssuers: [],
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
    card_ids: [],
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
  const inWindow = ['2026-08-15'];

  it('9. scans transferAlternatives and returns the first live match', () => {
    const noMatch = mkTransfer({ partnerProgram: 'Flying Blue' });
    const match = mkTransfer({ partnerProgram: 'World of Hyatt' });
    const result = mkResult([noMatch, match]);
    const bonus = mkBonus();
    expect(findLiveBonus(result, [bonus], NOW, inWindow)).toBe(bonus);
  });

  it('10. returns undefined when no transferAlternatives match any bonus', () => {
    const result = mkResult([mkTransfer({ partnerProgram: 'Flying Blue' })]);
    const bonus = mkBonus({ transfer_partner: 'World of Hyatt' });
    expect(findLiveBonus(result, [bonus], NOW, inWindow)).toBeUndefined();
  });

  it('11. returns undefined when transferAlternatives is empty', () => {
    const result = mkResult([]);
    expect(findLiveBonus(result, [mkBonus()], NOW, inWindow)).toBeUndefined();
  });

  it('12. returns undefined when bonuses list is empty', () => {
    const result = mkResult([mkTransfer()]);
    expect(findLiveBonus(result, [], NOW, inWindow)).toBeUndefined();
  });

  it('18. returns undefined when no search date falls inside the bonus window', () => {
    const result = mkResult([mkTransfer()]);
    const bonus = mkBonus({ end_date: '2026-08-31' });
    expect(findLiveBonus(result, [bonus], NOW, ['2026-09-15', '2026-09-20'])).toBeUndefined();
  });

  it('19. matches when only one of the two search dates falls inside the window', () => {
    const result = mkResult([mkTransfer()]);
    const bonus = mkBonus({ end_date: '2026-08-31' });
    expect(findLiveBonus(result, [bonus], NOW, ['2026-07-20', '2026-08-05'])).toBe(bonus);
  });
});

describe('matchesTripDates()', () => {
  it('20. true when a trip date sits inside an open-ended-start window', () => {
    const bonus = mkBonus({ start_date: null, end_date: '2026-08-31' });
    expect(matchesTripDates(bonus, ['2026-08-01'])).toBe(true);
  });

  it('21. false when every trip date is after end_date', () => {
    const bonus = mkBonus({ start_date: null, end_date: '2026-08-31' });
    expect(matchesTripDates(bonus, ['2026-09-01', '2026-09-10'])).toBe(false);
  });

  it('22. false when every trip date is before start_date', () => {
    const bonus = mkBonus({ start_date: '2026-08-01', end_date: '2026-08-31' });
    expect(matchesTripDates(bonus, ['2026-07-01'])).toBe(false);
  });

  it('23. true on exact start_date/end_date boundaries (inclusive)', () => {
    const bonus = mkBonus({ start_date: '2026-08-01', end_date: '2026-08-31' });
    expect(matchesTripDates(bonus, ['2026-08-01'])).toBe(true);
    expect(matchesTripDates(bonus, ['2026-08-31'])).toBe(true);
  });
});

describe('findBonusForEligibleCards()', () => {
  const card = (cardId: 'c1_venture_x' | 'chase_reserve', cardName: string) =>
    ({ cardId, cardName, multiplier: 1, ratioLabel: '1:1' });
  const issuer = (portalId: 'c1' | 'chase', owned: boolean, cardId: 'c1_venture_x' | 'chase_reserve', cardName: string) => {
    const only = card(cardId, cardName);
    return { portalId, owned, cards: [only], best: only, ratio: '1:1' };
  };
  const c1Owned = issuer('c1', true, 'c1_venture_x', 'Capital One Venture X');
  const chaseOwned = issuer('chase', true, 'chase_reserve', 'Chase Sapphire Reserve');
  const chaseUnowned = issuer('chase', false, 'chase_reserve', 'Chase Sapphire Reserve');

  it('13. finds a bonus on a second owned issuer, not just the row default', () => {
    const t = mkTransfer({ sourcePortalId: 'c1', sourceIssuers: [c1Owned, chaseOwned] });
    const match = findBonusForEligibleCards(t, [mkBonus({ issuer: 'chase' })], NOW);
    expect(match?.portalId).toBe('chase');
    expect(match?.card.cardId).toBe('chase_reserve');
  });

  it('14. ignores a bonus on an issuer the user does not hold', () => {
    const t = mkTransfer({ sourcePortalId: 'c1', sourceIssuers: [c1Owned, chaseUnowned] });
    expect(findBonusForEligibleCards(t, [mkBonus({ issuer: 'chase' })], NOW)).toBeUndefined();
  });

  it('15. ignores every bonus when no owned issuer reaches the partner', () => {
    const t = mkTransfer({ sourceIssuers: [chaseUnowned] });
    expect(findBonusForEligibleCards(t, [mkBonus({ issuer: 'chase' })], NOW)).toBeUndefined();
  });

  it('16. takes the biggest bonus among held issuers (server pre-sorts by bonus_pct desc)', () => {
    const t = mkTransfer({ sourceIssuers: [c1Owned, chaseOwned] });
    const bonuses = [mkBonus({ id: 'best', issuer: 'chase', bonus_pct: 50 }), mkBonus({ id: 'worse', issuer: 'c1', bonus_pct: 20 })];
    const match = findBonusForEligibleCards(t, bonuses, NOW);
    expect(match?.bonus.id).toBe('best');
    expect(match?.portalId).toBe('chase');
  });

  it('17. respects the live date window', () => {
    const t = mkTransfer({ sourceIssuers: [chaseOwned] });
    const expired = mkBonus({ issuer: 'chase', end_date: '2026-01-01' });
    expect(findBonusForEligibleCards(t, [expired], NOW)).toBeUndefined();
  });
});
