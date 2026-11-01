import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('@/lib/duffel', () => ({
  duffel: { stays: { search: vi.fn() } },
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
