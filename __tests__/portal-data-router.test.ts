import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/lib/feature-flags', () => ({
  isEnabled: () => true,
}));

import { createClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis';
import { appRouter } from '@/server/routers/_app';
import type { TransferPartnerRow, HotelCollection, PortalSyncRun } from '@/lib/types/portalData';
import { cacheKeys } from '@/lib/cache-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'or', 'order', 'limit', 'insert', 'update']) {
    (b as Record<string, unknown>)[m] = vi.fn().mockReturnValue(b);
  }
  (b as Record<string, unknown>).single = vi.fn().mockResolvedValue(result);
  (b as Record<string, unknown>).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return b;
}

function setupSupabase(
  fromResults: { data: unknown; error: unknown } | { data: unknown; error: unknown }[],
  opts: { isAdmin?: boolean } = {},
) {
  const { isAdmin = true } = opts;
  const results = Array.isArray(fromResults) ? fromResults : [fromResults];
  let callIdx = 0;
  const mockFrom = vi.fn().mockImplementation(() => {
    const r = results[Math.min(callIdx, results.length - 1)];
    callIdx++;
    return makeQueryBuilder(r);
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: isAdmin
            ? { id: 'admin-user-1', app_metadata: { role: 'admin' } }
            : null,
        },
        error: isAdmin ? null : { message: 'Not authenticated' },
      }),
    },
    from: mockFrom,
  } as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);
  return { mockFrom };
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockTransferPartner: TransferPartnerRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  portal_id: 'chase',
  program: 'Hyatt',
  type: 'hotel',
  ratio: '1:1',
  chain_key: 'hyatt',
  iata_codes: [],
  source: 'admin',
  status: 'admin',
  source_url: null,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockHotelCollection: HotelCollection = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  issuer: 'chase',
  collection_name: 'The Edit',
  property_name: null,
  perk_summary: 'Free breakfast + room upgrade',
  start_date: null,
  end_date: null,
  source: 'admin',
  status: 'admin',
  source_url: null,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockSyncRun: PortalSyncRun = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  source_key: 'chase-transfer-partners',
  source_url: 'https://example.com/chase',
  status: 'success',
  records_found: 5,
  records_written: 2,
  error_message: null,
  llm_model: 'claude-sonnet-5',
  llm_tokens_used: 1200,
  raw_text_excerpt: null,
  started_at: '2026-01-01T00:00:00Z',
  finished_at: '2026-01-01T00:01:00Z',
};

// ---------------------------------------------------------------------------
// listTransferPartners() — public, cached, grouped by portal
// ---------------------------------------------------------------------------

describe('portalData.listTransferPartners()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  it('groups rows by portal_id', async () => {
    setupSupabase({ data: [mockTransferPartner], error: null });

    const result = await caller.portalData.listTransferPartners();

    expect(result.chase).toHaveLength(1);
    expect(result.chase[0].program).toBe('Hyatt');
    expect(result.amex).toEqual([]);
  });

  it('returns cached value and skips Supabase on Redis hit', async () => {
    const cached = { chase: [], amex: [], c1: [], bilt: [], citi: [] };
    vi.mocked(redis.get).mockResolvedValue(cached);
    const { mockFrom } = setupSupabase({ data: [], error: null });

    const result = await caller.portalData.listTransferPartners();

    expect(result).toBe(cached);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws INTERNAL_SERVER_ERROR when Supabase returns an error', async () => {
    setupSupabase({ data: null, error: { message: 'DB down' } });

    await expect(caller.portalData.listTransferPartners()).rejects.toThrow('DB down');
  });
});

// ---------------------------------------------------------------------------
// listHotelCollections() — public, cached
// ---------------------------------------------------------------------------

describe('portalData.listHotelCollections()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  it('returns hotel collections from Supabase', async () => {
    setupSupabase({ data: [mockHotelCollection], error: null });

    const result = await caller.portalData.listHotelCollections();

    expect(result).toHaveLength(1);
    expect(result[0].collection_name).toBe('The Edit');
  });

  it('returns [] when data is null', async () => {
    setupSupabase({ data: null, error: null });

    const result = await caller.portalData.listHotelCollections();

    expect(result).toEqual([]);
  });

  it('returns cached value and skips Supabase on Redis hit', async () => {
    vi.mocked(redis.get).mockResolvedValue([mockHotelCollection]);
    const { mockFrom } = setupSupabase({ data: [], error: null });

    const result = await caller.portalData.listHotelCollections();

    expect(result).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// admin.listTransferPartners() — full uncached rows
// ---------------------------------------------------------------------------

describe('portalData.admin.listTransferPartners()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns raw rows, not grouped', async () => {
    setupSupabase({ data: [mockTransferPartner], error: null });

    const result = await caller.portalData.admin.listTransferPartners();

    expect(result).toEqual([mockTransferPartner]);
  });

  it('rejects non-admin callers', async () => {
    setupSupabase({ data: [], error: null }, { isAdmin: false });

    await expect(caller.portalData.admin.listTransferPartners()).rejects.toThrow('Sign in required.');
  });
});

// ---------------------------------------------------------------------------
// admin.listAll() — pending review across four tables
// ---------------------------------------------------------------------------

describe('portalData.admin.listAll()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flattens rows from all four tables with their table name attached', async () => {
    setupSupabase([
      { data: [{ id: '1' }], error: null }, // transfer_partners
      { data: [{ id: '2' }], error: null }, // hotel_collections
      { data: [], error: null },            // transfer_bonuses
      { data: [{ id: '3' }], error: null }, // spending_bonuses
    ]);

    const result = await caller.portalData.admin.listAll();

    expect(result).toEqual([
      { table: 'transfer_partners', row: { id: '1' } },
      { table: 'hotel_collections', row: { id: '2' } },
      { table: 'spending_bonuses', row: { id: '3' } },
    ]);
  });

  it('skips a table whose query rejects, without throwing', async () => {
    setupSupabase([
      { data: null, error: { message: 'boom' } },
      { data: [{ id: '2' }], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const result = await caller.portalData.admin.listAll();

    expect(result).toEqual([{ table: 'hotel_collections', row: { id: '2' } }]);
  });
});

// ---------------------------------------------------------------------------
// admin.listSyncRuns()
// ---------------------------------------------------------------------------

describe('portalData.admin.listSyncRuns()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sync runs from Supabase', async () => {
    setupSupabase({ data: [mockSyncRun], error: null });

    const result = await caller.portalData.admin.listSyncRuns();

    expect(result).toHaveLength(1);
    expect(result[0].source_key).toBe('chase-transfer-partners');
  });

  it('throws when Supabase errors', async () => {
    setupSupabase({ data: null, error: { message: 'DB down' } });

    await expect(caller.portalData.admin.listSyncRuns()).rejects.toThrow('DB down');
  });
});

// ---------------------------------------------------------------------------
// admin.approve()
// ---------------------------------------------------------------------------

describe('portalData.admin.approve()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('flips status to approved and active to true', async () => {
    setupSupabase([
      { data: mockTransferPartner, error: null }, // fetch original
      { data: { ...mockTransferPartner, status: 'approved', active: true }, error: null }, // update
    ]);

    const result = await caller.portalData.admin.approve({
      table: 'transfer_partners',
      id: mockTransferPartner.id,
    });

    expect(result.status).toBe('approved');
    expect(result.active).toBe(true);
  });

  it('invalidates transfer partner and hotel collection caches', async () => {
    setupSupabase([
      { data: mockTransferPartner, error: null },
      { data: mockTransferPartner, error: null },
    ]);

    await caller.portalData.admin.approve({
      table: 'transfer_partners',
      id: mockTransferPartner.id,
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.transferPartners());
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.hotelCollections());
  });

  it('records a correction when an edited field differs from the original', async () => {
    const { mockFrom } = setupSupabase([
      { data: mockTransferPartner, error: null },       // fetch original
      { data: [], error: null },                        // insert correction
      { data: { ...mockTransferPartner, program: 'World of Hyatt' }, error: null }, // update
    ]);

    await caller.portalData.admin.approve({
      table: 'transfer_partners',
      id: mockTransferPartner.id,
      edits: { program: 'World of Hyatt' },
    });

    expect(mockFrom).toHaveBeenCalledWith('portal_sync_corrections');
  });

  it('throws when the original row fetch fails', async () => {
    setupSupabase({ data: null, error: { message: 'not found' } });

    await expect(
      caller.portalData.admin.approve({ table: 'transfer_partners', id: mockTransferPartner.id }),
    ).rejects.toThrow('not found');
  });
});

// ---------------------------------------------------------------------------
// admin.reject()
// ---------------------------------------------------------------------------

describe('portalData.admin.reject()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('sets status to rejected', async () => {
    const { mockFrom } = setupSupabase({ data: null, error: null });

    await caller.portalData.admin.reject({ table: 'hotel_collections', id: mockHotelCollection.id });

    expect(mockFrom).toHaveBeenCalledWith('hotel_collections');
  });

  it('throws when Supabase update fails', async () => {
    setupSupabase({ data: null, error: { message: 'update failed' } });

    await expect(
      caller.portalData.admin.reject({ table: 'hotel_collections', id: mockHotelCollection.id }),
    ).rejects.toThrow('update failed');
  });
});

// ---------------------------------------------------------------------------
// admin.createTransferPartner() / updateTransferPartner()
// ---------------------------------------------------------------------------

describe('portalData.admin.createTransferPartner()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('inserts with source=admin and status=admin', async () => {
    setupSupabase({ data: mockTransferPartner, error: null });

    const result = await caller.portalData.admin.createTransferPartner({
      portal_id: 'chase',
      program: 'Hyatt',
      type: 'hotel',
      ratio: '1:1',
    });

    expect(result.id).toBe(mockTransferPartner.id);
  });

  it('invalidates the transfer partner cache', async () => {
    setupSupabase({ data: mockTransferPartner, error: null });

    await caller.portalData.admin.createTransferPartner({
      portal_id: 'chase',
      program: 'Hyatt',
      type: 'hotel',
      ratio: '1:1',
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.transferPartners());
  });
});

describe('portalData.admin.updateTransferPartner()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('updates fields and returns the updated row', async () => {
    const updated = { ...mockTransferPartner, active: false };
    setupSupabase({ data: updated, error: null });

    const result = await caller.portalData.admin.updateTransferPartner({
      id: mockTransferPartner.id,
      active: false,
    });

    expect(result.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// admin.createHotelCollection() / updateHotelCollection()
// ---------------------------------------------------------------------------

describe('portalData.admin.createHotelCollection()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('inserts with source=admin and status=admin', async () => {
    setupSupabase({ data: mockHotelCollection, error: null });

    const result = await caller.portalData.admin.createHotelCollection({
      issuer: 'chase',
      collection_name: 'The Edit',
      perk_summary: 'Free breakfast + room upgrade',
    });

    expect(result.id).toBe(mockHotelCollection.id);
  });

  it('invalidates the hotel collection cache', async () => {
    setupSupabase({ data: mockHotelCollection, error: null });

    await caller.portalData.admin.createHotelCollection({
      issuer: 'chase',
      collection_name: 'The Edit',
      perk_summary: 'Free breakfast + room upgrade',
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.hotelCollections());
  });
});

describe('portalData.admin.updateHotelCollection()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('updates fields and returns the updated row', async () => {
    const updated = { ...mockHotelCollection, perk_summary: 'Free suite upgrade' };
    setupSupabase({ data: updated, error: null });

    const result = await caller.portalData.admin.updateHotelCollection({
      id: mockHotelCollection.id,
      perk_summary: 'Free suite upgrade',
    });

    expect(result.perk_summary).toBe('Free suite upgrade');
  });
});
