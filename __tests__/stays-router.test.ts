import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('@/lib/duffel', () => ({
  duffel: { stays: { search: vi.fn(), accommodation: { get: vi.fn() }, searchResults: { fetchAllRates: vi.fn() } } },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

vi.mock('@/lib/feature-flags', () => ({
  // HotelBeds off so only the travel_collections lookup is exercised
  isEnabled: (flag: string) => flag !== 'integration:hotelbeds:stays',
}));

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: vi.fn(() => ({})),
}));

import { createClient } from '@/lib/supabase/server';
import { duffel } from '@/lib/duffel';
import { redis } from '@/lib/redis';
import { appRouter } from '@/server/routers/_app';
import { cacheKeys } from '@/lib/cache-config';

const INPUT = {
  latitude: 39.95,
  longitude: -75.16,
  checkInDate: '2026-12-01',
  checkOutDate: '2026-12-03',
  guests: [{ type: 'adult' as const }],
};

function makeCollectionsBuilder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in']) b[m] = vi.fn().mockReturnValue(b);
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  return b;
}

describe('stays.search — shared travel_collections cache', () => {
  const caller = appRouter.createCaller({});
  const collectionsKey = cacheKeys.travelCollections('hotel');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(duffel.stays.search).mockResolvedValue({ data: { results: [] } } as never);
  });

  it('queries only approved/admin rows that are active', async () => {
    const builder = makeCollectionsBuilder([]);
    const from = vi.fn().mockReturnValue(builder);
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await caller.stays.search(INPUT);

    expect(from).toHaveBeenCalledWith('travel_collections');
    expect(builder.eq).toHaveBeenCalledWith('type', 'hotel');
    expect(builder.in).toHaveBeenCalledWith('status', ['approved', 'admin']);
    expect(builder.eq).toHaveBeenCalledWith('active', true);
  });

  it('caches exactly what the filtered query returned under the shared key', async () => {
    const rows = [{ id: 'c1', type: 'hotel', status: 'approved', active: true }];
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn().mockReturnValue(makeCollectionsBuilder(rows)) } as never);

    await caller.stays.search(INPUT);

    const cached = vi.mocked(redis.set).mock.calls.find(([key]) => key === collectionsKey);
    expect(cached?.[1]).toEqual(rows);
  });

  it('skips the database on a cache hit', async () => {
    vi.mocked(redis.get).mockImplementation(async (key: string) => (key === collectionsKey ? [] : null));
    const from = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await caller.stays.search(INPUT);

    expect(from).not.toHaveBeenCalled();
  });
});

describe('stays.search — Duffel results cache', () => {
  const caller = appRouter.createCaller({});
  const loc = { geographic_coordinates: { latitude: 39.95, longitude: -75.16 } };
  const bookable = { accommodation: { id: 'acc_1', name: 'Hotel One', location: loc }, cheapest_rate_total_amount: '120.00' };
  const unbookable = { accommodation: { id: 'acc_2', name: 'Hotel Two', location: loc }, cheapest_rate_total_amount: '0.00' };
  const searchKeyCalls = () =>
    vi.mocked(redis.set).mock.calls.filter(([key]) => String(key).startsWith('stay:search:'));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn().mockReturnValue(makeCollectionsBuilder([])) } as never);
    vi.mocked(duffel.stays.search).mockResolvedValue({ data: { results: [bookable, unbookable] } } as never);
  });

  it('on a miss, calls Duffel once and caches only the bookable results for 15 minutes', async () => {
    const out = await caller.stays.search(INPUT);

    expect(duffel.stays.search).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
    const calls = searchKeyCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual([bookable]);
    expect(calls[0][2]).toEqual({ ex: 15 * 60 });
  });

  it('writes nothing per hotel any more', async () => {
    await caller.stays.search(INPUT);
    expect(vi.mocked(redis.set).mock.calls.some(([key]) => String(key).startsWith('stay:accommodation:'))).toBe(false);
  });

  it('on a hit, skips Duffel entirely and returns the cached results', async () => {
    vi.mocked(redis.get).mockImplementation(async (key: string) => (String(key).startsWith('stay:search:') ? [bookable] : null));

    const out = await caller.stays.search(INPUT);

    expect(duffel.stays.search).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ accommodation: { id: 'acc_1' } });
    expect(searchKeyCalls()).toHaveLength(0);
  });

  it('ignores a cached entry whose Duffel result ids are about to expire, and searches again', async () => {
    const soon = { ...bookable, expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString() };
    vi.mocked(redis.get).mockImplementation(async (key: string) => (String(key).startsWith('stay:search:') ? [soon] : null));

    await caller.stays.search(INPUT);

    expect(duffel.stays.search).toHaveBeenCalledTimes(1);
  });

  it('serves a cached entry whose ids have plenty of life left', async () => {
    const fresh = { ...bookable, expires_at: new Date(Date.now() + 40 * 60 * 1000).toISOString() };
    vi.mocked(redis.get).mockImplementation(async (key: string) => (String(key).startsWith('stay:search:') ? [fresh] : null));

    await caller.stays.search(INPUT);

    expect(duffel.stays.search).not.toHaveBeenCalled();
  });

  it('keys on every input that changes the answer', async () => {
    const keyFor = async (input: typeof INPUT & Record<string, unknown>) => {
      vi.mocked(redis.set).mockClear();
      await caller.stays.search(input);
      return searchKeyCalls()[0][0];
    };
    const base = await keyFor(INPUT);

    expect(await keyFor({ ...INPUT })).toBe(base);
    expect(await keyFor({ ...INPUT, checkOutDate: '2026-12-04' })).not.toBe(base);
    expect(await keyFor({ ...INPUT, guests: [{ type: 'adult' as const }, { type: 'adult' as const }] })).not.toBe(base);
    expect(await keyFor({ ...INPUT, freeCancellationOnly: true })).not.toBe(base);
    expect(await keyFor({ ...INPUT, radius: 12 })).not.toBe(base);
  });
});

describe('stays.search — Duffel timeout', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn().mockReturnValue(makeCollectionsBuilder([])) } as never);
  });

  it('gives up on a Duffel call that never answers instead of hanging', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      vi.mocked(duffel.stays.search).mockReturnValue(new Promise(() => {}) as never);
      const pending = caller.stays.search(INPUT);
      const assertion = expect(pending).rejects.toThrow(/duffel\.stays timed out after 15000ms/);
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
      // nothing half-finished gets cached
      expect(vi.mocked(redis.set).mock.calls.some(([key]) => String(key).startsWith('stay:search:'))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('stays.accommodationDetails — Duffel timeout', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  it('does not hang when Duffel never answers the rates call: it stops waiting after the timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      vi.mocked(duffel.stays.accommodation.get).mockResolvedValue({ data: { rooms: [], description: 'x' } } as never);
      vi.mocked(duffel.stays.searchResults.fetchAllRates).mockReturnValue(new Promise(() => {}) as never);

      let settled = false;
      const pending = caller.stays.accommodationDetails({ accommodationId: 'acc_1', searchResultId: 'srr_1' })
        .then(() => { settled = true; }, () => { settled = true; });

      await vi.advanceTimersByTimeAsync(14_000);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1_500);
      await pending;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
