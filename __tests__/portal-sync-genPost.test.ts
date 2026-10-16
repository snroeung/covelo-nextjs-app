import { describe, it, expect } from 'vitest';
import { genBoardPost, boardPostColumns, type BoardOfferView } from '../scripts/portal-sync/genPost';
import { transferBonusToBoardOffer } from '@/lib/board/offerView';

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

describe('boardPostColumns', () => {
  it('returns the cron insert columns', () => {
    expect(boardPostColumns(TRANSFER)).toEqual({
      board_post_title: genBoardPost(TRANSFER).title,
      board_post_body: genBoardPost(TRANSFER).body,
    });
  });
});

describe('genBoardPost from a catalog row', () => {
  it('turns a status-match tier into post copy', () => {
    const o = transferBonusToBoardOffer({ issuer: 'bilt', transfer_partner: 'Accor', bonus_pct: null, min_transfer_points: 5000, end_date: '2026-12-31' });
    expect(genBoardPost(o).title).toBe('Accor status match via Bilt (transfer at least 5,000 pts) — ends Dec 31');
  });
});
