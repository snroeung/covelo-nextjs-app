import { describe, it, expect } from 'vitest';
import { rowTitle, rowDetail, needsPublish, queueReason, rejectReasonsFor, isBoardRow } from '@/components/offers/admin/PendingReviewTable';
import type { PendingReviewRow } from '@/lib/types/portalData';

describe('rowTitle', () => {
  it('titles a hotel travel_collection with the property name', () => {
    const item: PendingReviewRow = {
      table: 'travel_collections',
      row: { issuer: 'chase', collection_name: 'Points Boost', property_name: 'The Ritz-Carlton New York' },
    };
    expect(rowTitle(item)).toBe('chase · Points Boost — The Ritz-Carlton New York');
  });

  it('titles a routed flight travel_collection with the airline and route', () => {
    const item: PendingReviewRow = {
      table: 'travel_collections',
      row: {
        issuer: 'chase',
        collection_name: 'Points Boost',
        property_name: null,
        airline_name: 'Iberia',
        origin_iata_code: 'BOS',
        destination_iata_code: 'MAD',
      },
    };
    expect(rowTitle(item)).toBe('chase · Points Boost — Iberia BOS–MAD');
  });

  it('titles an airline-only flight travel_collection (no route yet) with just the airline', () => {
    const item: PendingReviewRow = {
      table: 'travel_collections',
      row: {
        issuer: 'chase',
        collection_name: 'Points Boost',
        property_name: null,
        airline_name: 'United Airlines',
        origin_iata_code: null,
        destination_iata_code: null,
      },
    };
    expect(rowTitle(item)).toBe('chase · Points Boost — United Airlines');
  });

  it('falls back to just the collection name when neither property nor airline is set', () => {
    const item: PendingReviewRow = {
      table: 'travel_collections',
      row: { issuer: 'chase', collection_name: 'Points Boost', property_name: null },
    };
    expect(rowTitle(item)).toBe('chase · Points Boost');
  });
});

describe('board rows', () => {
  it('titles an offer post with its title and says what the admin is being asked', () => {
    const item: PendingReviewRow = { table: 'board_posts', row: { id: 'p1', title: 'Bilt → Hyatt 30%', author_name: 'milesnerd', queue_reason: 'offer_review' } };
    expect(rowTitle(item)).toBe('Bilt → Hyatt 30%');
    expect(rowDetail(item)).toBe('milesnerd · offer to verify');
  });

  it('describes held content, posts and comments alike', () => {
    const post: PendingReviewRow = { table: 'board_posts', row: { id: 'p1', title: 'Held tip', author_name: 'pointsplease', queue_reason: 'held' } };
    const comment: PendingReviewRow = { table: 'board_comments', row: { id: 'c1', body: 'a'.repeat(300), author_name: 'biltbear', queue_reason: 'held' } };
    expect(rowDetail(post)).toBe('pointsplease · held');
    expect(rowTitle(comment)).toHaveLength(120);
    expect(rowDetail(comment)).toBe('biltbear · held');
  });
});

describe('board queue helpers', () => {
  const offerPost = (over: Record<string, unknown> = {}): PendingReviewRow => ({ table: 'board_posts', row: { id: 'p1', title: 'Virgin 25%', author_name: 'biltbear', queue_reason: 'offer_review', ...over } });

  it('marks member-created offers as needing Review & publish, and nothing else', () => {
    expect(needsPublish(offerPost({ member_offer_id: 'mo1' }))).toBe(true);
    expect(needsPublish(offerPost({ member_offer_id: null }))).toBe(false); // links a catalog offer: Verify is enough
    expect(needsPublish(offerPost({ member_offer_id: 'mo1', queue_reason: 'held' }))).toBe(false); // release the hold first
    expect(needsPublish({ table: 'transfer_bonuses', row: { id: 't1', member_offer_id: 'x' } })).toBe(false);
  });

  it('knows board rows and their reason', () => {
    expect(isBoardRow(offerPost())).toBe(true);
    expect(isBoardRow({ table: 'transfer_partners', row: { id: 'x' } })).toBe(false);
    expect(queueReason(offerPost({ queue_reason: 'reported' }))).toBe('reported');
    expect(queueReason({ table: 'transfer_partners', row: { id: 'x' } })).toBeNull();
  });

  it('describes reported content with its report count and member-created offers', () => {
    expect(rowDetail(offerPost({ queue_reason: 'reported', report_count: 1 }))).toBe('biltbear · reported · 1 report');
    expect(rowDetail(offerPost({ member_offer_id: 'mo1', report_count: 3 }))).toBe('biltbear · offer to verify · member-created offer · 3 reports');
  });

  it('picks the reject reasons from the right list: rejection for offers, removal for everything else', () => {
    expect(rejectReasonsFor(offerPost()).reasons).toContain("Can't confirm terms");
    expect(rejectReasonsFor(offerPost({ queue_reason: 'held' })).reasons).toContain('Offensive');
    expect(rejectReasonsFor(offerPost({ queue_reason: 'reported' })).reasons).not.toContain("Can't confirm terms");
  });
});
