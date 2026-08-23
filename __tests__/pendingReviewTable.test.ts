import { describe, it, expect } from 'vitest';
import { rowTitle } from '@/components/offers/admin/PendingReviewTable';
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
