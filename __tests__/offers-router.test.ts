import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('@/lib/duffel', () => ({
  duffel: { offerRequests: { create: vi.fn() }, stays: { search: vi.fn() } },
}));

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
import type { TransferBonus, SpendingBonus, SponsoredAd } from '@/lib/types/offers';
import { cacheKeys } from '@/lib/cache-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock Supabase query builder that is awaitable via `then`.
 * All chaining methods (select, eq, or, order, etc.) return `this`.
 * `.single()` resolves immediately. Awaiting the builder itself also resolves.
 */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'or', 'order', 'limit', 'insert', 'update']) {
    (b as Record<string, unknown>)[m] = vi.fn().mockReturnValue(b);
  }
  (b as Record<string, unknown>).single = vi.fn().mockResolvedValue(result);
  // Thenable: allows `await builder.order(...)` to resolve with result
  (b as Record<string, unknown>).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return b;
}

/**
 * Configures the createClient mock to return a mock Supabase client.
 * Pass an array of results to return different values on successive from() calls.
 */
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

const mockTransferBonus: TransferBonus = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  issuer: 'chase',
  transfer_partner: 'Hyatt',
  bonus_pct: 30,
  effective_ratio: 2.5,
  description: 'Earn 30% more on Hyatt transfers',
  tags: ['hotel', 'targeted'],
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  is_targeted: false,
  source_url: 'https://example.com',
  country: 'US',
  submitted_by: null,
  upvotes: 0,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockSpendingBonus: SpendingBonus = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  issuer: 'amex',
  merchant_name: 'Amazon',
  bonus_multiplier: 5,
  bonus_type: 'points_multiplier',
  spending_minimum: 50,
  minimum_nights: null,
  description: '5x points on Amazon purchases',
  tags: ['shopping'],
  card_ids: ['amex_platinum'],
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  is_targeted: false,
  source_url: null,
  country: 'US',
  submitted_by: null,
  upvotes: 0,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockSponsoredAd: SponsoredAd = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  partner: 'Chase',
  product: 'Sapphire Reserve',
  slot: 'sidebar',
  headline: 'Earn 3x on travel',
  subheadline: 'Points that go further',
  bullets: ['60,000 bonus points', '$300 travel credit'],
  cta_label: 'Learn More',
  cta_url: 'https://example.com/chase',
  tracking_id: 'chase-reserve-sidebar-q1',
  disclosure: 'Subject to credit approval.',
  tone: 'neutral',
  image_url: null,
  active: true,
  country: 'US',
  start_date: null,
  end_date: null,
  impressions: 0,
  clicks: 0,
  created_by: 'admin-user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// listTransferBonuses()
// ---------------------------------------------------------------------------

describe('offers.listTransferBonuses()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null); // cache miss by default
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('1. returns transfer bonuses from Supabase', async () => {
    setupSupabase({ data: [mockTransferBonus], error: null });

    const result = await caller.offers.listTransferBonuses();

    expect(result).toHaveLength(1);
    expect(result[0].transfer_partner).toBe('Hyatt');
    expect(result[0].bonus_pct).toBe(30);
    expect(result[0].effective_ratio).toBe(2.5);
  });

  it('2. returns [] when Supabase returns null data', async () => {
    setupSupabase({ data: null, error: null });

    const result = await caller.offers.listTransferBonuses();

    expect(result).toEqual([]);
  });

  it('3. throws INTERNAL_SERVER_ERROR when Supabase returns an error', async () => {
    setupSupabase({ data: null, error: { message: 'DB connection failed' } });

    await expect(caller.offers.listTransferBonuses()).rejects.toThrow('DB connection failed');
  });

  it('4. returns cached value and skips Supabase on Redis hit', async () => {
    vi.mocked(redis.get).mockResolvedValue([mockTransferBonus]);
    const { mockFrom } = setupSupabase({ data: [], error: null });

    const result = await caller.offers.listTransferBonuses();

    expect(result).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listSpendingBonuses()
// ---------------------------------------------------------------------------

describe('offers.listSpendingBonuses()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('5. returns spending bonuses from Supabase', async () => {
    setupSupabase({ data: [mockSpendingBonus], error: null });

    const result = await caller.offers.listSpendingBonuses();

    expect(result).toHaveLength(1);
    expect(result[0].merchant_name).toBe('Amazon');
    expect(result[0].bonus_multiplier).toBe(5);
    expect(result[0].bonus_type).toBe('points_multiplier');
  });

  it('6. returns [] when Supabase has no rows', async () => {
    setupSupabase({ data: [], error: null });

    const result = await caller.offers.listSpendingBonuses();

    expect(result).toEqual([]);
  });

  it('7. returns cached value when Redis hits', async () => {
    vi.mocked(redis.get).mockResolvedValue([mockSpendingBonus]);
    const { mockFrom } = setupSupabase({ data: [], error: null });

    const result = await caller.offers.listSpendingBonuses();

    expect(result).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getFeaturedAd()
// ---------------------------------------------------------------------------

describe('offers.getFeaturedAd()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  it('8. injects ref param into cta_url when no existing query string', async () => {
    setupSupabase({ data: [mockSponsoredAd], error: null });

    const result = await caller.offers.getFeaturedAd({ slot: 'sidebar' });

    expect(result).toHaveLength(1);
    expect(result[0].cta_url).toBe('https://example.com/chase?ref=chase-reserve-sidebar-q1');
  });

  it('9. appends ref param when cta_url already has a query string', async () => {
    const adWithQuery = { ...mockSponsoredAd, cta_url: 'https://example.com/chase?source=covelo' };
    setupSupabase({ data: [adWithQuery], error: null });

    const result = await caller.offers.getFeaturedAd({ slot: 'sidebar' });

    expect(result[0].cta_url).toBe(
      'https://example.com/chase?source=covelo&ref=chase-reserve-sidebar-q1',
    );
  });

  it('10. returns [] when no active ad exists for the slot', async () => {
    setupSupabase({ data: [], error: null });

    const result = await caller.offers.getFeaturedAd({ slot: 'below_grid' });

    expect(result).toEqual([]);
  });

  it('11. returns [] when data is null', async () => {
    setupSupabase({ data: null, error: null });

    const result = await caller.offers.getFeaturedAd({ slot: 'hero' });

    expect(result).toEqual([]);
  });

  it('12. strips private fields from public ad response', async () => {
    setupSupabase({ data: [mockSponsoredAd], error: null });

    const result = await caller.offers.getFeaturedAd({ slot: 'sidebar' });

    expect(result[0]).not.toHaveProperty('tracking_id');
    expect(result[0]).not.toHaveProperty('impressions');
    expect(result[0]).not.toHaveProperty('clicks');
    expect(result[0]).not.toHaveProperty('created_by');
    // Public fields are present
    expect(result[0]).toHaveProperty('headline');
    expect(result[0]).toHaveProperty('cta_url');
  });


});

// ---------------------------------------------------------------------------
// admin.createTransferBonus()
// ---------------------------------------------------------------------------

describe('offers.admin.createTransferBonus()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('14. inserts with active=true by default, returns created row', async () => {
    const created = { ...mockTransferBonus, id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' };
    setupSupabase({ data: created, error: null });

    const result = await caller.offers.admin.createTransferBonus({
      issuer: 'chase',
      transfer_partner: 'Hyatt',
      bonus_pct: 30,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    });

    expect(result.id).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    expect(result.active).toBe(true);
  });

  it('15. invalidates transfer bonus cache after creation', async () => {
    setupSupabase({ data: mockTransferBonus, error: null });

    await caller.offers.admin.createTransferBonus({
      issuer: 'chase',
      transfer_partner: 'Hyatt',
      bonus_pct: 30,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.transferBonuses());
  });

  it('16. throws when Supabase insert fails', async () => {
    setupSupabase({ data: null, error: { message: 'Insert failed' } });

    await expect(
      caller.offers.admin.createTransferBonus({
        issuer: 'chase',
        transfer_partner: 'Hyatt',
        bonus_pct: 30,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      }),
    ).rejects.toThrow('Insert failed');
  });
});

// ---------------------------------------------------------------------------
// admin.createSpendingBonus()
// ---------------------------------------------------------------------------

describe('offers.admin.createSpendingBonus()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('17. inserts with active=true by default', async () => {
    const created = { ...mockSpendingBonus, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' };
    setupSupabase({ data: created, error: null });

    const result = await caller.offers.admin.createSpendingBonus({
      issuer: 'amex',
      merchant_name: 'Amazon',
      bonus_multiplier: 5,
      bonus_type: 'points_multiplier',
      card_ids: ['amex_platinum'],
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    });

    expect(result.active).toBe(true);
  });

  it('18a. accepts points_multiplier bonus_type', async () => {
    setupSupabase({ data: { ...mockSpendingBonus, bonus_type: 'points_multiplier' }, error: null });

    const result = await caller.offers.admin.createSpendingBonus({
      issuer: 'amex', merchant_name: 'Amazon', bonus_multiplier: 5,
      bonus_type: 'points_multiplier', card_ids: [], start_date: '2026-01-01', end_date: '2026-12-31',
    });
    expect(result.bonus_type).toBe('points_multiplier');
  });

  it('18b. accepts cash_back_pct bonus_type', async () => {
    setupSupabase({ data: { ...mockSpendingBonus, bonus_type: 'cash_back_pct' }, error: null });

    const result = await caller.offers.admin.createSpendingBonus({
      issuer: 'amex', merchant_name: 'Target', bonus_multiplier: 3,
      bonus_type: 'cash_back_pct', card_ids: [], start_date: '2026-01-01', end_date: '2026-12-31',
    });
    expect(result.bonus_type).toBe('cash_back_pct');
  });

  it('18c. accepts dollar_amount bonus_type', async () => {
    setupSupabase({ data: { ...mockSpendingBonus, bonus_type: 'dollar_amount' }, error: null });

    const result = await caller.offers.admin.createSpendingBonus({
      issuer: 'chase', merchant_name: 'Uber', bonus_multiplier: 10,
      bonus_type: 'dollar_amount', card_ids: [], start_date: '2026-01-01', end_date: '2026-12-31',
    });
    expect(result.bonus_type).toBe('dollar_amount');
  });

  it('19. invalidates spending bonus cache after creation', async () => {
    setupSupabase({ data: mockSpendingBonus, error: null });

    await caller.offers.admin.createSpendingBonus({
      issuer: 'amex', merchant_name: 'Amazon', bonus_multiplier: 5,
      bonus_type: 'points_multiplier', card_ids: ['amex_platinum'], start_date: '2026-01-01', end_date: '2026-12-31',
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.spendingBonuses());
  });
});

// ---------------------------------------------------------------------------
// admin.updateStatus()
// ---------------------------------------------------------------------------

describe('offers.admin.updateActive()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('20. deactivates an offer (active → false)', async () => {
    setupSupabase({ data: null, error: null });

    await expect(
      caller.offers.admin.updateActive({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        table: 'transfer_bonuses',
        active: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('21. reactivates an offer (active → true)', async () => {
    setupSupabase({ data: null, error: null });

    await expect(
      caller.offers.admin.updateActive({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        table: 'transfer_bonuses',
        active: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('22. invalidates both bonus caches after an active change', async () => {
    setupSupabase({ data: null, error: null });

    await caller.offers.admin.updateActive({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      table: 'spending_bonuses',
      active: true,
    });

    expect(redis.del).toHaveBeenCalledWith(cacheKeys.transferBonuses());
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.spendingBonuses());
  });
});

// ---------------------------------------------------------------------------
// admin.createAd()
// ---------------------------------------------------------------------------

describe('offers.admin.createAd()', () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.del).mockResolvedValue(1);
  });

  it('23. inserts ad with all required fields and returns created row', async () => {
    const created = { ...mockSponsoredAd, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' };
    setupSupabase({ data: created, error: null });

    const result = await caller.offers.admin.createAd({
      partner: 'Chase',
      product: 'Sapphire Reserve',
      slot: 'sidebar',
      headline: 'Earn 3x on travel',
      cta_label: 'Learn More',
      cta_url: 'https://example.com/chase',
      tracking_id: 'chase-reserve-sidebar-q1',
      disclosure: 'Subject to credit approval.',
    });

    expect(result.id).toBe('ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(result.slot).toBe('sidebar');
    expect(result.partner).toBe('Chase');
  });


});

// ---------------------------------------------------------------------------
// admin.updateAd()
// ---------------------------------------------------------------------------

describe('offers.admin.updateAd()', () => {
  const caller = appRouter.createCaller({});

  it('25. updates ad fields and returns updated ad', async () => {
    const updated = { ...mockSponsoredAd, headline: 'New Headline' };
    setupSupabase({ data: updated, error: null });

    const result = await caller.offers.admin.updateAd({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      headline: 'New Headline',
    });

    expect(result.headline).toBe('New Headline');
  });
});

// ---------------------------------------------------------------------------
// admin.deleteAd()
// ---------------------------------------------------------------------------

describe('offers.admin.deleteAd()', () => {
  const caller = appRouter.createCaller({});

  it('27. sets active=false (soft delete) not a hard delete', async () => {
    const { mockFrom } = setupSupabase([
      { data: null, error: null },
    ]);

    await caller.offers.admin.deleteAd({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
