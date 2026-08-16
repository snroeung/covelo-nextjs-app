import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  upsertTransferPartner,
  upsertTransferBonus,
  upsertSpendingBonus,
  upsertTravelCollection,
  upsertPointsValuation,
  upsertRecord,
  TABLE_BY_RECORD_TYPE,
} from '../scripts/portal-sync/upsert';
import type {
  TransferPartnerRecord,
  TransferBonusRecord,
  SpendingBonusRecord,
  TravelCollectionRecord,
  PointsValuationRecord,
} from '../scripts/portal-sync/schemas';

// Chainable query/insert builder. `.select().eq().eq().limit()` is awaited
// directly (thenable), matching how upsert.ts's hasMatchingRow consumes it.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.is = () => b;
  b.limit = () => b;
  b.insert = () => Promise.resolve({ error: result.error });
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return b;
}

// Queue of per-`.from()`-call results, consumed in call order.
function makeSupabase(fromResults: Array<{ data: unknown; error: unknown }>): SupabaseClient {
  let i = 0;
  return {
    from: () => makeQueryBuilder(fromResults[i++] ?? { data: null, error: null }),
  } as unknown as SupabaseClient;
}

const sourceUrl = 'https://example.com/rewards';

describe('upsertTransferPartner', () => {
  const record: TransferPartnerRecord = {
    portal_id: 'chase',
    program: 'United MileagePlus',
    type: 'airline',
    ratio: '1:1',
  };

  it('skips insert and returns false when an approved match already exists', async () => {
    const supabase = makeSupabase([{ data: [{ program: 'United MileagePlus' }], error: null }]);
    const result = await upsertTransferPartner({ supabase, sourceUrl }, record);
    expect(result).toBe(false);
  });

  it('skips insert when an approved match exists with different punctuation', async () => {
    const supabase = makeSupabase([
      { data: [{ program: 'Air France-KLM Flying Blue' }], error: null },
    ]);
    const result = await upsertTransferPartner(
      { supabase, sourceUrl },
      { ...record, program: 'Air France/KLM Flying Blue' },
    );
    expect(result).toBe(false);
  });

  it('skips insert when an approved match exists with an extra "Airlines" word', async () => {
    const supabase = makeSupabase([
      { data: [{ program: 'United Airlines MileagePlus' }], error: null },
    ]);
    const result = await upsertTransferPartner(
      { supabase, sourceUrl },
      { ...record, program: 'United MileagePlus' },
    );
    expect(result).toBe(false);
  });

  it('skips insert when an approved match exists with "Airlines" in a different position', async () => {
    const supabase = makeSupabase([
      { data: [{ program: 'Southwest Rapid Rewards' }], error: null },
    ]);
    const result = await upsertTransferPartner(
      { supabase, sourceUrl },
      { ...record, program: 'Southwest Airlines Rapid Rewards' },
    );
    expect(result).toBe(false);
  });

  it('skips insert when an approved match exists under a known program alias', async () => {
    const supabase = makeSupabase([
      { data: [{ program: 'British Airways Executive Club' }], error: null },
    ]);
    const result = await upsertTransferPartner(
      { supabase, sourceUrl },
      { ...record, program: 'British Airways Avios' },
    );
    expect(result).toBe(false);
  });

  it('inserts a pending cron candidate when no approved match exists', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: null, error: null },
    ]);
    const result = await upsertTransferPartner({ supabase, sourceUrl }, record);
    expect(result).toBe(true);
  });

  it('returns false when the insert itself errors', async () => {
    const supabase = makeSupabase([
      { data: [], error: null }, // hasTransferPartnerMatch: approved - no dedup match
      { data: [], error: null }, // hasTransferPartnerMatch: pending - no dedup match
      { data: null, error: { message: 'insert failed' } }, // insert
    ]);
    const result = await upsertTransferPartner({ supabase, sourceUrl }, record);
    expect(result).toBe(false);
  });
});

describe('upsertTransferBonus', () => {
  const record: TransferBonusRecord = {
    issuer: 'chase',
    transfer_partner: 'United MileagePlus',
    bonus_pct: 25,
    end_date: '2026-12-31',
    limited_time_offer: true,
    for_status_transfer: false,
  };

  it('skips insert when an approved match exists', async () => {
    const supabase = makeSupabase([
      { data: [{ transfer_partner: 'United MileagePlus' }], error: null },
    ]);
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(false);
  });

  it('skips insert when an approved match exists with different punctuation', async () => {
    const supabase = makeSupabase([
      { data: [{ transfer_partner: 'United Airlines MileagePlus' }], error: null },
    ]);
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(false);
  });

  it('inserts when no approved match exists, keeping the raw name when no canonical transfer_partners row matches', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },  // hasApprovedTransferBonusMatch: no dedup match
      { data: [], error: null },  // resolveCanonicalPartnerName: no transfer_partners match
      { data: null, error: null }, // insert
    ]);
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(true);
  });

  it('defaults for_status_transfer to false when omitted from the record', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let i = 0;
    const fromResults = [
      { data: [], error: null }, // hasApprovedTransferBonusMatch: no dedup match
      { data: [], error: null }, // resolveCanonicalPartnerName: no match
    ];
    const supabase = {
      from: () => {
        const result = fromResults[i++] ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.limit = () => b;
        b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return b;
      },
    } as unknown as SupabaseClient;
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(true);
    expect(insertedRow?.for_status_transfer).toBe(false);
  });

  it('persists for_status_transfer: true when the record sets it (e.g. Bilt Rent Day status transfer)', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let i = 0;
    const fromResults = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    const supabase = {
      from: () => {
        const result = fromResults[i++] ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.limit = () => b;
        b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return b;
      },
    } as unknown as SupabaseClient;
    expect(await upsertTransferBonus({ supabase, sourceUrl }, { ...record, for_status_transfer: true })).toBe(true);
    expect(insertedRow?.for_status_transfer).toBe(true);
  });

  it('persists min_transfer_points and null bonus_pct for status-match-only rows (e.g. Bilt -> Accor)', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let i = 0;
    const fromResults = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    const supabase = {
      from: () => {
        const result = fromResults[i++] ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.limit = () => b;
        b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return b;
      },
    } as unknown as SupabaseClient;
    const statusOnlyRecord: TransferBonusRecord = {
      issuer: 'bilt',
      transfer_partner: 'Accor Live Limitless',
      bonus_pct: undefined,
      min_transfer_points: 5000,
      end_date: '2026-08-01',
      limited_time_offer: true,
      for_status_transfer: true,
    };
    expect(await upsertTransferBonus({ supabase, sourceUrl }, statusOnlyRecord)).toBe(true);
    expect(insertedRow?.bonus_pct).toBe(null);
    expect(insertedRow?.min_transfer_points).toBe(5000);
    expect(insertedRow?.for_status_transfer).toBe(true);
  });

  it('rewrites transfer_partner to the canonical approved transfer_partners spelling when found', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let i = 0;
    const fromResults = [
      { data: [], error: null }, // hasTransferBonusMatch: approved - no dedup match
      { data: [], error: null }, // hasTransferBonusMatch: pending - no dedup match
      { data: [{ program: 'United Airlines MileagePlus' }], error: null }, // resolveCanonicalPartnerName: found
    ];
    const supabase = {
      from: () => {
        const result = fromResults[i++] ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.limit = () => b;
        b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return b;
      },
    } as unknown as SupabaseClient;
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(true);
    expect(insertedRow?.transfer_partner).toBe('United Airlines MileagePlus');
  });

  it('passes through card_ids that belong to the record issuer', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let i = 0;
    const fromResults = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    const supabase = {
      from: () => {
        const result = fromResults[i++] ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.limit = () => b;
        b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return b;
      },
    } as unknown as SupabaseClient;
    expect(await upsertTransferBonus({ supabase, sourceUrl }, { ...record, card_ids: ['chase_reserve'] })).toBe(true);
    expect(insertedRow?.card_ids).toEqual(['chase_reserve']);
  });

  it('filters out card_ids that do not belong to the record issuer', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let i = 0;
    const fromResults = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    const supabase = {
      from: () => {
        const result = fromResults[i++] ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.limit = () => b;
        b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return b;
      },
    } as unknown as SupabaseClient;
    expect(await upsertTransferBonus({ supabase, sourceUrl }, { ...record, card_ids: ['amex_platinum'] })).toBe(true);
    expect(insertedRow?.card_ids).toEqual([]);
  });

  it('defaults card_ids to an empty array when omitted', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    let i = 0;
    const fromResults = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    const supabase = {
      from: () => {
        const result = fromResults[i++] ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.limit = () => b;
        b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
        b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return b;
      },
    } as unknown as SupabaseClient;
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(true);
    expect(insertedRow?.card_ids).toEqual([]);
  });
});

describe('upsertSpendingBonus', () => {
  const record: SpendingBonusRecord = {
    issuer: 'amex',
    merchant_name: 'Marriott',
    bonus_multiplier: 5,
    bonus_type: 'points_multiplier',
    end_date: '2026-12-31',
    limited_time_offer: true,
  };

  it('skips insert when an approved match exists', async () => {
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    expect(await upsertSpendingBonus({ supabase, sourceUrl }, record)).toBe(false);
  });

  it('inserts when no approved match exists', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: null, error: null },
    ]);
    expect(await upsertSpendingBonus({ supabase, sourceUrl }, record)).toBe(true);
  });

  it('passes through card_ids that belong to the record issuer', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    const supabase = makeSupabase([{ data: [], error: null }]);
    supabase.from = (() => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.limit = () => b;
      b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
      b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
      return b;
    }) as unknown as typeof supabase.from;
    expect(await upsertSpendingBonus({ supabase, sourceUrl }, { ...record, card_ids: ['amex_gold'] })).toBe(true);
    expect(insertedRow?.card_ids).toEqual(['amex_gold']);
  });

  it('filters out card_ids that do not belong to the record issuer', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    const supabase = makeSupabase([{ data: [], error: null }]);
    supabase.from = (() => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.limit = () => b;
      b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
      b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
      return b;
    }) as unknown as typeof supabase.from;
    expect(await upsertSpendingBonus({ supabase, sourceUrl }, { ...record, card_ids: ['chase_reserve'] })).toBe(true);
    expect(insertedRow?.card_ids).toEqual([]);
  });

  it('defaults card_ids to an empty array when omitted', async () => {
    let insertedRow: Record<string, unknown> | undefined;
    const supabase = makeSupabase([{ data: [], error: null }]);
    supabase.from = (() => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.limit = () => b;
      b.insert = (row: Record<string, unknown>) => { insertedRow = row; return Promise.resolve({ error: null }); };
      b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
      return b;
    }) as unknown as typeof supabase.from;
    expect(await upsertSpendingBonus({ supabase, sourceUrl }, record)).toBe(true);
    expect(insertedRow?.card_ids).toEqual([]);
  });
});

describe('upsertTravelCollection', () => {
  const hotelRecord: TravelCollectionRecord = {
    issuer: 'c1',
    type: 'hotel',
    collection_name: 'Premier Collection',
    property_name: 'The Ritz-Carlton New York',
    perk_summary: 'Free breakfast + $100 credit',
    limited_time_offer: false,
  };

  const flightRecord: TravelCollectionRecord = {
    issuer: 'chase',
    type: 'flight',
    collection_name: 'Points Boost',
    airline_name: 'United Airlines',
    airline_iata_code: 'UA',
    cabin_class: 'business',
    perk_summary: 'Boosted redemption rate',
    limited_time_offer: true,
  };

  it('skips insert when an approved match exists', async () => {
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    expect(await upsertTravelCollection({ supabase, sourceUrl }, hotelRecord)).toBe(false);
  });

  it('inserts when no approved match exists', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: null, error: null },
    ]);
    expect(await upsertTravelCollection({ supabase, sourceUrl }, hotelRecord)).toBe(true);
  });

  it('dedups hotel-type records on (issuer, collection_name, property_name)', async () => {
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    let seenTable = '';
    const seenMatch: Record<string, unknown> = {};
    supabase.from = ((table: string) => {
      seenTable = table;
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (key: string, value: unknown) => {
        seenMatch[key] = value;
        return b;
      };
      b.is = () => b;
      b.limit = () => b;
      b.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [{ id: 'existing' }], error: null }).then(resolve);
      return b;
    }) as unknown as typeof supabase.from;
    await upsertTravelCollection({ supabase, sourceUrl }, hotelRecord);
    expect(seenTable).toBe('travel_collections');
    expect(seenMatch).toEqual({
      issuer: 'c1',
      collection_name: 'Premier Collection',
      property_name: 'The Ritz-Carlton New York',
      status: 'approved',
    });
  });

  it('dedups flight-type records on (issuer, collection_name, airline_iata_code, cabin_class)', async () => {
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    const seenMatch: Record<string, unknown> = {};
    supabase.from = (() => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (key: string, value: unknown) => {
        seenMatch[key] = value;
        return b;
      };
      b.is = () => b;
      b.limit = () => b;
      b.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [{ id: 'existing' }], error: null }).then(resolve);
      return b;
    }) as unknown as typeof supabase.from;
    await upsertTravelCollection({ supabase, sourceUrl }, flightRecord);
    expect(seenMatch).toEqual({
      issuer: 'chase',
      collection_name: 'Points Boost',
      airline_iata_code: 'UA',
      cabin_class: 'business',
      status: 'approved',
    });
  });
});

describe('upsertPointsValuation', () => {
  const record: PointsValuationRecord = {
    program: 'World of Hyatt',
    cpp: 1.7,
    source_month: 'August 2026',
  };

  // Dedup keyed on (program, source_month), not program alone — a key
  // scoped to program alone would silently drop every subsequent month's
  // real update (the same failure mode fixed once already for the
  // Amex/transfer-bonus sources, commit e1999c0, by adding end_date to
  // their match).
  it('dedups on (program, source_month)', async () => {
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    let seenTable = '';
    const seenMatch: Record<string, unknown> = {};
    supabase.from = ((table: string) => {
      seenTable = table;
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (key: string, value: unknown) => {
        seenMatch[key] = value;
        return b;
      };
      b.is = () => b;
      b.limit = () => b;
      b.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [{ id: 'existing' }], error: null }).then(resolve);
      return b;
    }) as unknown as typeof supabase.from;
    await upsertPointsValuation({ supabase, sourceUrl }, record);
    expect(seenTable).toBe('points_valuations');
    expect(seenMatch).toEqual({
      program: 'World of Hyatt',
      source_month: 'August 2026',
      status: 'approved',
    });
  });

  it('no-ops (skips insert) when a pending row for the same program and source_month already exists', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },             // approved check: no match
      { data: [{ id: 'existing' }], error: null }, // pending check: match
    ]);
    expect(await upsertPointsValuation({ supabase, sourceUrl }, record)).toBe(false);
  });

  it('inserts a new pending candidate when the program advances to a new source_month', async () => {
    const supabase = makeSupabase([
      { data: [], error: null }, // approved check: no match for this source_month
      { data: [], error: null }, // pending check: no match for this source_month
      { data: null, error: null }, // insert
    ]);
    expect(await upsertPointsValuation({ supabase, sourceUrl }, { ...record, source_month: 'September 2026' })).toBe(true);
  });

  it('returns false when the insert itself errors', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: { message: 'insert failed' } },
    ]);
    expect(await upsertPointsValuation({ supabase, sourceUrl }, record)).toBe(false);
  });
});

describe('upsertRecord', () => {
  it('dispatches transfer_partner records to upsertTransferPartner', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: null, error: null },
    ]);
    const record: TransferPartnerRecord = {
      portal_id: 'bilt',
      program: 'Hyatt',
      type: 'hotel',
      ratio: '1:1',
    };
    expect(await upsertRecord({ supabase, sourceUrl }, 'transfer_partner', record)).toBe(true);
  });

  it('dispatches points_valuation records to upsertPointsValuation', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
    ]);
    const record: PointsValuationRecord = {
      program: 'Chase Ultimate Rewards',
      cpp: 2.0,
      source_month: 'August 2026',
    };
    expect(await upsertRecord({ supabase, sourceUrl }, 'points_valuation', record)).toBe(true);
  });

  it('returns false for an unrecognized record type', async () => {
    const supabase = makeSupabase([]);
    const result = await upsertRecord(
      { supabase, sourceUrl },
      'unknown_type' as never,
      {} as never,
    );
    expect(result).toBe(false);
  });

  it('maps every record type to its table name', () => {
    expect(TABLE_BY_RECORD_TYPE.transfer_partner).toBe('transfer_partners');
    expect(TABLE_BY_RECORD_TYPE.transfer_bonus).toBe('transfer_bonuses');
    expect(TABLE_BY_RECORD_TYPE.spending_bonus).toBe('spending_bonuses');
    expect(TABLE_BY_RECORD_TYPE.travel_collection).toBe('travel_collections');
    expect(TABLE_BY_RECORD_TYPE.points_valuation).toBe('points_valuations');
  });
});
