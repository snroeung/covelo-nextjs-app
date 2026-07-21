import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  upsertTransferPartner,
  upsertTransferBonus,
  upsertSpendingBonus,
  upsertHotelCollection,
  upsertRecord,
  TABLE_BY_RECORD_TYPE,
} from '../scripts/portal-sync/upsert';
import type {
  TransferPartnerRecord,
  TransferBonusRecord,
  SpendingBonusRecord,
  HotelCollectionRecord,
} from '../scripts/portal-sync/schemas';

// Chainable query/insert builder. `.select().eq().eq().limit()` is awaited
// directly (thenable), matching how upsert.ts's hasApprovedMatch consumes it.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
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
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    const result = await upsertTransferPartner({ supabase, sourceUrl }, record);
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
      { data: [], error: null },
      { data: null, error: { message: 'insert failed' } },
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
  };

  it('skips insert when an approved match exists', async () => {
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(false);
  });

  it('inserts when no approved match exists', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: null, error: null },
    ]);
    expect(await upsertTransferBonus({ supabase, sourceUrl }, record)).toBe(true);
  });
});

describe('upsertSpendingBonus', () => {
  const record: SpendingBonusRecord = {
    issuer: 'amex',
    merchant_name: 'Marriott',
    bonus_multiplier: 5,
    bonus_type: 'points_multiplier',
    end_date: '2026-12-31',
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
});

describe('upsertHotelCollection', () => {
  const record: HotelCollectionRecord = {
    issuer: 'c1',
    collection_name: 'Premier Collection',
    perk_summary: 'Free breakfast + $100 credit',
  };

  it('skips insert when an approved match exists', async () => {
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }]);
    expect(await upsertHotelCollection({ supabase, sourceUrl }, record)).toBe(false);
  });

  it('inserts when no approved match exists', async () => {
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: null, error: null },
    ]);
    expect(await upsertHotelCollection({ supabase, sourceUrl }, record)).toBe(true);
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
    expect(TABLE_BY_RECORD_TYPE.hotel_collection).toBe('hotel_collections');
  });
});
