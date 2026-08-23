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
import type { TransferPartnerRow, TravelCollection, PortalSyncRun, PointsValuation } from '@/lib/types/portalData';
import { cacheKeys } from '@/lib/cache-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'insert', 'update']) {
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

const mockTravelCollection: TravelCollection = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  issuer: 'chase',
  type: 'hotel',
  collection_name: 'The Edit',
  property_name: null,
  airline_name: null,
  airline_iata_code: null,
  origin_iata_code: null,
  destination_iata_code: null,
  cabin_class: null,
  perk_summary: 'Free breakfast + room upgrade',
  original_amount: null,
  original_unit: null,
  discount_amount: null,
  discount_unit: null,
  end_date: null,
  limited_time_offer: false,
  source: 'admin',
  status: 'admin',
  source_url: null,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPointsValuation: PointsValuation = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  program: 'World of Hyatt',
  cpp: 1.7,
  source_month: 'August 2026',
  source: 'cron',
  status: 'pending',
  source_url: 'https://thepointsguy.com/loyalty-programs/monthly-valuations/',
  active: false,
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

describe('portalData.listTravelCollections()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  it('returns travel collections from Supabase', async () => {
    setupSupabase({ data: [mockTravelCollection], error: null });

    const result = await caller.portalData.listTravelCollections();

    expect(result).toHaveLength(1);
    expect(result[0].collection_name).toBe('The Edit');
  });

  it('returns [] when data is null', async () => {
    setupSupabase({ data: null, error: null });

    const result = await caller.portalData.listTravelCollections();

    expect(result).toEqual([]);
  });

  it('returns cached value and skips Supabase on Redis hit', async () => {
    vi.mocked(redis.get).mockResolvedValue([mockTravelCollection]);
    const { mockFrom } = setupSupabase({ data: [], error: null });

    const result = await caller.portalData.listTravelCollections();

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
// admin.listPointsValuations() — full uncached rows
// ---------------------------------------------------------------------------

describe('portalData.admin.listPointsValuations()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns raw rows', async () => {
    setupSupabase({ data: [mockPointsValuation], error: null });

    const result = await caller.portalData.admin.listPointsValuations();

    expect(result).toEqual([mockPointsValuation]);
  });

  it('rejects non-admin callers', async () => {
    setupSupabase({ data: [], error: null }, { isAdmin: false });

    await expect(caller.portalData.admin.listPointsValuations()).rejects.toThrow('Sign in required.');
  });
});

// ---------------------------------------------------------------------------
// admin.listAll() — pending review across five tables
// ---------------------------------------------------------------------------

describe('portalData.admin.listAll()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flattens rows from all five tables with their table name attached', async () => {
    setupSupabase([
      { data: [{ id: '1' }], error: null }, // transfer_partners
      { data: [{ id: '2' }], error: null }, // travel_collections
      { data: [], error: null },            // transfer_bonuses
      { data: [{ id: '3' }], error: null }, // spending_bonuses
      { data: [{ id: '4' }], error: null }, // points_valuations
    ]);

    const result = await caller.portalData.admin.listAll();

    expect(result).toEqual([
      { table: 'transfer_partners', row: { id: '1' } },
      { table: 'travel_collections', row: { id: '2' } },
      { table: 'spending_bonuses', row: { id: '3' } },
      { table: 'points_valuations', row: { id: '4' } },
    ]);
  });

  it('skips a table whose query rejects, without throwing', async () => {
    setupSupabase([
      { data: null, error: { message: 'boom' } },
      { data: [{ id: '2' }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const result = await caller.portalData.admin.listAll();

    expect(result).toEqual([{ table: 'travel_collections', row: { id: '2' } }]);
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

  it('invalidates transfer partner and travel collection caches', async () => {
    setupSupabase([
      { data: mockTransferPartner, error: null },
      { data: mockTransferPartner, error: null },
    ]);

    await caller.portalData.admin.approve({
      table: 'transfer_partners',
      id: mockTransferPartner.id,
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.transferPartners());
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.travelCollections('hotel'));
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.travelCollections('flight'));
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

  // A program can accumulate multiple approved points_valuations rows over
  // time (dedup key is program+source_month, a new month inserts rather than
  // overwrites) — approving one supersedes (deactivates) any other
  // approved+active row for the same program, matched via sameProgram().
  it('deactivates another approved+active points_valuations row for the same program', async () => {
    const approved = { ...mockPointsValuation, status: 'approved' as const, active: true };
    const { mockFrom } = setupSupabase([
      { data: mockPointsValuation, error: null },                                  // fetch original
      { data: approved, error: null },                                             // main update
      { data: [{ id: 'stale-id', program: 'World of Hyatt' }], error: null },       // select other approved rows
      { data: null, error: null },                                                 // supersede update
    ]);

    await caller.portalData.admin.approve({ table: 'points_valuations', id: mockPointsValuation.id });

    expect(mockFrom).toHaveBeenCalledTimes(4);
    const supersedeBuilder = mockFrom.mock.results[3].value as { update: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> };
    expect(supersedeBuilder.update).toHaveBeenCalledWith({ active: false });
    expect(supersedeBuilder.in).toHaveBeenCalledWith('id', ['stale-id']);
  });

  it('deactivates a stale row matched via sameProgram() aliasing, not just an exact string', async () => {
    const approved = { ...mockPointsValuation, program: 'British Airways Avios', status: 'approved' as const, active: true };
    const { mockFrom } = setupSupabase([
      { data: { ...mockPointsValuation, program: 'British Airways Avios' }, error: null },
      { data: approved, error: null },
      { data: [{ id: 'stale-id', program: 'British Airways Executive Club' }], error: null },
      { data: null, error: null },
    ]);

    await caller.portalData.admin.approve({ table: 'points_valuations', id: mockPointsValuation.id });

    const supersedeBuilder = mockFrom.mock.results[3].value as { in: ReturnType<typeof vi.fn> };
    expect(supersedeBuilder.in).toHaveBeenCalledWith('id', ['stale-id']);
  });

  it('leaves a different program\'s approved row untouched', async () => {
    const approved = { ...mockPointsValuation, status: 'approved' as const, active: true };
    const { mockFrom } = setupSupabase([
      { data: mockPointsValuation, error: null },
      { data: approved, error: null },
      { data: [{ id: 'other-id', program: 'Marriott Bonvoy' }], error: null }, // unrelated program
    ]);

    await caller.portalData.admin.approve({ table: 'points_valuations', id: mockPointsValuation.id });

    // No 4th call — nothing matched, so the supersede update never fires.
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it('makes no supersede update when no other approved row exists', async () => {
    const approved = { ...mockPointsValuation, status: 'approved' as const, active: true };
    const { mockFrom } = setupSupabase([
      { data: mockPointsValuation, error: null },
      { data: approved, error: null },
      { data: [], error: null }, // no other approved rows at all
    ]);

    await caller.portalData.admin.approve({ table: 'points_valuations', id: mockPointsValuation.id });

    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it('does not run the supersede lookup for non-points_valuations tables', async () => {
    const { mockFrom } = setupSupabase([
      { data: mockTransferPartner, error: null },
      { data: mockTransferPartner, error: null },
    ]);

    await caller.portalData.admin.approve({ table: 'transfer_partners', id: mockTransferPartner.id });

    // Only fetch original + main update — no extra points_valuations lookup.
    expect(mockFrom).toHaveBeenCalledTimes(2);
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

    await caller.portalData.admin.reject({ table: 'travel_collections', id: mockTravelCollection.id });

    expect(mockFrom).toHaveBeenCalledWith('travel_collections');
  });

  it('throws when Supabase update fails', async () => {
    setupSupabase({ data: null, error: { message: 'update failed' } });

    await expect(
      caller.portalData.admin.reject({ table: 'travel_collections', id: mockTravelCollection.id }),
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

describe('portalData.admin.createTravelCollection()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('inserts with source=admin and status=admin', async () => {
    setupSupabase({ data: mockTravelCollection, error: null });

    const result = await caller.portalData.admin.createTravelCollection({
      issuer: 'chase',
      type: 'hotel',
      collection_name: 'The Edit',
      perk_summary: 'Free breakfast + room upgrade',
    });

    expect(result.id).toBe(mockTravelCollection.id);
  });

  it('invalidates the travel collection caches', async () => {
    setupSupabase({ data: mockTravelCollection, error: null });

    await caller.portalData.admin.createTravelCollection({
      issuer: 'chase',
      type: 'hotel',
      collection_name: 'The Edit',
      perk_summary: 'Free breakfast + room upgrade',
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.travelCollections('hotel'));
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.travelCollections('flight'));
  });

  it('inserts a flight-type record with airline fields', async () => {
    const flightCollection = { ...mockTravelCollection, type: 'flight' as const, airline_iata_code: 'UA' };
    setupSupabase({ data: flightCollection, error: null });

    const result = await caller.portalData.admin.createTravelCollection({
      issuer: 'chase',
      type: 'flight',
      collection_name: 'Points Boost',
      airline_name: 'United Airlines',
      airline_iata_code: 'UA',
      cabin_class: 'business',
      perk_summary: 'Boosted redemption rate',
    });

    expect(result.type).toBe('flight');
  });
});

describe('portalData.admin.updateTravelCollection()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('updates fields and returns the updated row', async () => {
    const updated = { ...mockTravelCollection, perk_summary: 'Free suite upgrade' };
    setupSupabase({ data: updated, error: null });

    const result = await caller.portalData.admin.updateTravelCollection({
      id: mockTravelCollection.id,
      perk_summary: 'Free suite upgrade',
    });

    expect(result.perk_summary).toBe('Free suite upgrade');
  });
});

// ---------------------------------------------------------------------------
// admin.createPointsValuation() / updatePointsValuation()
// ---------------------------------------------------------------------------

describe('portalData.admin.createPointsValuation()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('inserts with source=admin and status=admin', async () => {
    setupSupabase({ data: mockPointsValuation, error: null });

    const result = await caller.portalData.admin.createPointsValuation({
      program: 'World of Hyatt',
      cpp: 1.7,
      source_month: 'August 2026',
    });

    expect(result.id).toBe(mockPointsValuation.id);
  });

  it('invalidates the points valuations cache', async () => {
    setupSupabase({ data: mockPointsValuation, error: null });

    await caller.portalData.admin.createPointsValuation({
      program: 'World of Hyatt',
      cpp: 1.7,
      source_month: 'August 2026',
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.pointsValuations());
  });

  it('rejects a non-positive cpp', async () => {
    setupSupabase({ data: mockPointsValuation, error: null });

    await expect(caller.portalData.admin.createPointsValuation({
      program: 'World of Hyatt',
      cpp: 0,
      source_month: 'August 2026',
    })).rejects.toThrow();
  });
});

describe('portalData.admin.updatePointsValuation()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('updates fields and returns the updated row', async () => {
    const updated = { ...mockPointsValuation, active: false };
    setupSupabase({ data: updated, error: null });

    const result = await caller.portalData.admin.updatePointsValuation({
      id: mockPointsValuation.id,
      active: false,
    });

    expect(result.active).toBe(false);
  });
});
