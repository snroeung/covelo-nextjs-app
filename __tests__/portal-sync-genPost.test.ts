import { describe, it, expect } from 'vitest';
import {
  genBoardPost, boardPostColumns, transferBonusToBoardOffer, spendingBonusToBoardOffer,
  type BoardOfferView,
} from '../scripts/portal-sync/genPost';

const TRANSFER: BoardOfferView = {
  type: 'TRANSFER BONUS', title: '30% transfer bonus · Bilt → World of Hyatt', value: '+30%',
  detail: '1,000 pts → 1,300 pts', from: 'Bilt', to: 'World of Hyatt', ends: 'Nov 30',
  terms: 'One-time transfers only.',
};

describe('genBoardPost', () => {
  it('writes a transfer bonus post', () => {
    expect(genBoardPost(TRANSFER)).toEqual({
      title: 'Bilt → World of Hyatt +30% transfer bonus is live — ends Nov 30',
      body: '+30% · Bilt → World of Hyatt. 1,000 pts → 1,300 pts. Ends Nov 30. One-time transfers only.',
    });
  });

  it('writes a sign-up bonus post, falling back to "minimum spend"', () => {
    const o: BoardOfferView = { type: 'SIGN-UP BONUS', title: 'Sapphire Reserve', value: '60k', from: 'Chase' };
    expect(genBoardPost(o).title).toBe('Sapphire Reserve: 60k after minimum spend');
  });

  it('writes other types from the title + detail, capitalizing the detail sentence', () => {
    const o: BoardOfferView = { type: 'STATEMENT CREDIT', title: '$75 credit at Delta', value: '$75', detail: 'min. spend $300', from: 'Chase', to: 'Delta Air Lines' };
    expect(genBoardPost(o)).toEqual({
      title: '$75 credit at Delta (min. spend $300)',
      body: '$75 · Chase → Delta Air Lines. Min. spend $300.',
    });
  });

  it('omits the route arrow without a destination', () => {
    expect(genBoardPost({ type: 'FREE NIGHT', title: 'Free night', value: 'Free', from: 'World of Hyatt' }).body).toBe('Free · World of Hyatt.');
  });
});

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
    expect(genBoardPost(o).title).toBe('Accor Live Limitless status match via Bilt (transfer at least 5,000 pts) — ends Dec 31');
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

describe('boardPostColumns', () => {
  it('returns the cron insert columns', () => {
    expect(boardPostColumns(TRANSFER)).toEqual({
      board_post_title: genBoardPost(TRANSFER).title,
      board_post_body: genBoardPost(TRANSFER).body,
    });
  });
});
