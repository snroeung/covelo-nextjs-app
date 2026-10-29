import { vi, beforeEach, describe, it, expect } from 'vitest';
import { makeDb, called, eqValue, type Handler } from './board/utils/fakeDb';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: () => true }));

import { createClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis';
import { appRouter } from '@/server/routers/_app';
import { widestLiveOfferFilter } from '@/lib/offers/live';

const ME = 'user-1';
const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const S1 = '33333333-3333-4333-8333-333333333333';
const DAY = 24 * 3600 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

const caller = () => appRouter.createCaller({});

/** The member's own session client: what RLS lets them read and write. */
function setup(handlers: Record<string, Handler> = {}, signedIn = true) {
  const db = makeDb(handlers);
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: signedIn ? { id: ME, app_metadata: {} } : null }, error: signedIn ? null : { message: 'no session' } }) },
    from: db.client.from,
  } as never);
  return db;
}

const transfer = (id: string, over: Record<string, unknown> = {}) => ({ id, issuer: 'chase', transfer_partner: 'Hyatt', bonus_pct: 30, end_date: iso(10), active: true, ...over });
const spending = (id: string, over: Record<string, unknown> = {}) => ({ id, issuer: 'amex', merchant_name: 'Delta', bonus_multiplier: 5, end_date: iso(10), active: true, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.get).mockResolvedValue(null);
  vi.mocked(redis.set).mockResolvedValue('OK' as never);
});

describe('offers.listTransferBonuses / listSpendingBonuses — ended offers', () => {
  it('asks the database for live offers explicitly (an admin session would otherwise see ended ones, and the list is cached for everyone)', async () => {
    const db = setup({ transfer_bonuses: () => ({ data: [transfer(T1)] }), spending_bonuses: () => ({ data: [spending(S1)] }) });
    await caller().offers.listTransferBonuses();
    await caller().offers.listSpendingBonuses();
    for (const table of ['transfer_bonuses', 'spending_bonuses']) {
      const q = db.of(table)[0];
      expect(called(q, 'eq', 'active', true)).toBe(true);
      expect(called(q, 'or', widestLiveOfferFilter())).toBe(true);
    }
  });

  it('re-checks a cached list, since it can outlive an offer by its TTL', async () => {
    setup();
    vi.mocked(redis.get).mockResolvedValueOnce([transfer(T1), transfer(T2, { end_date: iso(-1) })]);
    const out = await caller().offers.listTransferBonuses();
    expect(out.map((o) => o.id)).toEqual([T1]);

    vi.mocked(redis.get).mockResolvedValueOnce([spending(S1, { end_date: iso(-3) })]);
    expect(await caller().offers.listSpendingBonuses()).toEqual([]);
  });
});

describe('offers.saved', () => {
  it('is for signed-in members only', async () => {
    setup({}, false);
    await expect(caller().offers.saved()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns live saved offers from both tables, most recently saved first', async () => {
    const db = setup({
      saved_offers: () => ({ data: [
        { offer_table: 'spending_bonuses', offer_id: S1 },
        { offer_table: 'transfer_bonuses', offer_id: T2 },
        { offer_table: 'transfer_bonuses', offer_id: T1 },
      ] }),
      transfer_bonuses: () => ({ data: [transfer(T1), transfer(T2)] }), // not in saved order
      spending_bonuses: () => ({ data: [spending(S1)] }),
    });
    const out = await caller().offers.saved();
    expect(out.map((o) => o.id)).toEqual([S1, T2, T1]);

    const saves = db.of('saved_offers')[0];
    expect(eqValue(saves, 'user_id')).toBe(ME);
    expect(called(saves, 'order', 'created_at', { ascending: false })).toBe(true);
    // Only live ones are fetched
    expect(called(db.of('transfer_bonuses')[0], 'or', widestLiveOfferFilter())).toBe(true);
    expect(called(db.of('transfer_bonuses')[0], 'in', 'id', [T2, T1])).toBe(true);
  });

  it('drops a saved offer that has ended, been switched off or deleted', async () => {
    setup({
      saved_offers: () => ({ data: [
        { offer_table: 'transfer_bonuses', offer_id: T1 },
        { offer_table: 'transfer_bonuses', offer_id: T2 },
        { offer_table: 'spending_bonuses', offer_id: S1 },
      ] }),
      transfer_bonuses: () => ({ data: [transfer(T1)] }), // T2 ended: the live filter leaves it out
      spending_bonuses: () => ({ data: [] }),              // S1 was deleted
    });
    expect((await caller().offers.saved()).map((o) => o.id)).toEqual([T1]);
  });

  it('is empty without querying the offer tables when nothing is saved', async () => {
    const db = setup({ saved_offers: () => ({ data: [] }) });
    expect(await caller().offers.saved()).toEqual([]);
    expect(db.of('transfer_bonuses')).toHaveLength(0);
    expect(db.of('spending_bonuses')).toHaveLength(0);
  });
});

describe('offers.save', () => {
  const input = { table: 'transfer_bonuses' as const, id: T1, saved: true };

  it('is for signed-in members only', async () => {
    setup({}, false);
    await expect(caller().offers.save(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('saves a live offer for this member', async () => {
    const db = setup({
      transfer_bonuses: () => ({ data: { id: T1, active: true, end_date: iso(5) } }),
      saved_offers: (q) => (q.head ? { count: 3 } : undefined),
    });
    await expect(caller().offers.save(input)).resolves.toEqual({ saved: true });
    expect(db.of('saved_offers', 'upsert')[0].payload).toEqual({ user_id: ME, offer_table: 'transfer_bonuses', offer_id: T1 });
  });

  it('can save an offer on its last day', async () => {
    setup({ transfer_bonuses: () => ({ data: { id: T1, active: true, end_date: iso(0) } }) });
    await expect(caller().offers.save(input)).resolves.toEqual({ saved: true });
  });

  it.each([
    ['one that has ended', { id: T1, active: true, end_date: iso(-1) }],
    ['one that is switched off', { id: T1, active: false, end_date: iso(5) }],
    ['one that does not exist', null],
  ])('refuses %s, and writes nothing', async (_name, row) => {
    const db = setup({ transfer_bonuses: () => ({ data: row }) });
    await expect(caller().offers.save(input)).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/isn't available/) });
    expect(db.of('saved_offers', 'upsert')).toHaveLength(0);
  });

  it('stops at 100 saved, but still lets a saved one be saved again', async () => {
    const full = (already: boolean): Record<string, Handler> => ({
      transfer_bonuses: () => ({ data: { id: T1, active: true, end_date: iso(5) } }),
      saved_offers: (q) => (q.head ? { count: 100 } : q.single ? { data: already ? { offer_id: T1 } : null } : undefined),
    });
    setup(full(false));
    await expect(caller().offers.save(input)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    setup(full(true));
    await expect(caller().offers.save(input)).resolves.toEqual({ saved: true });
  });

  it('unsaves with a delete scoped to this member and offer — no lookup needed, so an ended offer can still be removed', async () => {
    const db = setup();
    await expect(caller().offers.save({ ...input, saved: false })).resolves.toEqual({ saved: false });
    const del = db.of('saved_offers', 'delete')[0];
    expect(called(del, 'match', { user_id: ME, offer_table: 'transfer_bonuses', offer_id: T1 })).toBe(true);
    expect(db.of('transfer_bonuses')).toHaveLength(0);
  });

  it('validates the input', async () => {
    setup();
    await expect(caller().offers.save({ ...input, id: 'nope' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller().offers.save({ ...input, table: 'sponsored_ads' as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
