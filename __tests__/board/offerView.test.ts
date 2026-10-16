import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  transferBonusToBoardOffer, spendingBonusToBoardOffer, endsInLabel, catalogTransferOffer, catalogSpendingOffer, memberOffer,
} from '@/lib/board/offerView';

afterEach(() => vi.useRealTimers());

describe('transferBonusToBoardOffer', () => {
  it('maps a percentage bonus with issuer label, ratio detail and short end date', () => {
    expect(transferBonusToBoardOffer({
      issuer: 'bilt', transfer_partner: 'World of Hyatt', bonus_pct: 30, end_date: '2026-11-30',
      description: '  One-time transfers only.  ',
    })).toEqual({
      type: 'TRANSFER BONUS', value: '+30%', title: '30% transfer bonus · Bilt → World of Hyatt',
      detail: '1,000 pts → 1,300 pts', from: 'Bilt', to: 'World of Hyatt', ends: 'Nov 30',
      terms: 'One-time transfers only.',
    });
  });

  it('maps a status-match tier with no percentage', () => {
    const o = transferBonusToBoardOffer({ issuer: 'bilt', transfer_partner: 'Accor Live Limitless', bonus_pct: null, min_transfer_points: 5000, end_date: '2026-12-31' });
    expect(o).toMatchObject({ type: 'STATUS MATCH', value: '5,000+ pts', detail: 'transfer at least 5,000 pts' });
  });

  it('handles a missing end date and blank description', () => {
    expect(transferBonusToBoardOffer({ issuer: 'c1', transfer_partner: 'Avianca LifeMiles', bonus_pct: 20, end_date: null, description: ' ' }))
      .toMatchObject({ from: 'Capital One', ends: null, terms: null });
  });
});

describe('spendingBonusToBoardOffer', () => {
  it('maps a dollar credit with minimum spend', () => {
    expect(spendingBonusToBoardOffer({
      issuer: 'chase', merchant_name: 'Delta Air Lines', bonus_multiplier: 75, bonus_type: 'dollar_amount',
      spending_minimum: 300, end_date: '2026-10-31',
    })).toMatchObject({ type: 'STATEMENT CREDIT', value: '$75', title: '$75 credit at Delta Air Lines', detail: 'min. spend $300', from: 'Chase', ends: 'Oct 31' });
  });

  it('maps cash back and points multipliers, joining both minimums', () => {
    expect(spendingBonusToBoardOffer({ issuer: 'amex', merchant_name: 'Amazon', bonus_multiplier: 5, bonus_type: 'cash_back_pct' }))
      .toMatchObject({ type: 'CASH BACK', value: '5%', detail: null, from: 'American Express' });
    expect(spendingBonusToBoardOffer({ issuer: 'bilt', merchant_name: 'Marriott Bonvoy', bonus_multiplier: 5, bonus_type: 'points_multiplier', spending_minimum: 1000, minimum_nights: 2 }))
      .toMatchObject({ type: 'POINTS BONUS', value: '5×', detail: 'min. spend $1,000 · 2 nights minimum' });
  });
});

describe('endsInLabel', () => {
  it('counts days from a fixed clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 13, 12, 0, 0));
    expect(endsInLabel(null)).toBe('ongoing');
    expect(endsInLabel('2026-10-12')).toBe('expired');
    expect(endsInLabel('2026-10-13')).toBe('ends today');
    expect(endsInLabel('2026-10-14')).toBe('1 day left');
    expect(endsInLabel('2026-10-20')).toBe('7 days left');
  });
});

describe('API offers', () => {
  it('builds a catalog transfer offer with its table, id, source url and time left', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 13, 12, 0, 0));
    expect(catalogTransferOffer({
      id: 'o-1', issuer: 'bilt', transfer_partner: 'World of Hyatt', bonus_pct: 30, end_date: '2026-10-20', source_url: 'https://www.biltrewards.com/promos',
    })).toMatchObject({ source: 'catalog', table: 'transfer_bonuses', id: 'o-1', value: '+30%', endsIn: '7 days left', url: 'https://www.biltrewards.com/promos', terms: null });
  });

  it('builds a catalog spending offer with no end date as ongoing', () => {
    expect(catalogSpendingOffer({ id: 'o-2', issuer: 'c1', merchant_name: 'Hotels', bonus_multiplier: 5, bonus_type: 'points_multiplier', end_date: null }))
      .toMatchObject({ source: 'catalog', table: 'spending_bonuses', endsIn: 'ongoing', ends: null, url: null });
  });

  it('builds a member offer from a board_member_offers row', () => {
    expect(memberOffer({
      id: 'm-1', type: 'TRANSFER BONUS', value: '+25%', name: '25% transfer bonus · Amex → Virgin', from_program: 'Amex',
      to_program: 'Virgin Atlantic', conditions: 'Max 50k', ends_label: 'Jun 30', source_url: null,
    })).toEqual({
      source: 'member', table: null, id: 'm-1', type: 'TRANSFER BONUS', value: '+25%', title: '25% transfer bonus · Amex → Virgin',
      from: 'Amex', to: 'Virgin Atlantic', detail: 'Max 50k', ends: 'Jun 30', endsIn: null, terms: null, url: null,
    });
  });
});
