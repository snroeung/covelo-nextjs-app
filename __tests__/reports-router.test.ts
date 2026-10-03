import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('@/lib/duffel', () => ({
  duffel: { offerRequests: { create: vi.fn() }, stays: { search: vi.fn() } },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

const flagState = { enabled: true };
vi.mock('@/lib/feature-flags', () => ({ isEnabled: () => flagState.enabled }));

import { createClient } from '@/lib/supabase/server';
import { appRouter } from '@/server/routers/_app';

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'insert']) b[m] = vi.fn().mockReturnValue(b);
  b.single = vi.fn().mockResolvedValue(result);
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
  return b;
}

function setup(userId: string | null, fromResults: { data: unknown; error: unknown }[]) {
  let i = 0;
  const builders: Record<string, unknown>[] = [];
  const from = vi.fn().mockImplementation(() => {
    const b = makeQueryBuilder(fromResults[Math.min(i++, fromResults.length - 1)]);
    builders.push(b);
    return b;
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: userId ? null : { message: 'no session' },
      }),
    },
    from,
  } as never);
  return { from, builders };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1', user_id: 'u-other', reporter_name: 'Ana', option_key: 'chase', result: 'matched',
  quoted_cash: '1302', reported_cash: '1302', reported_points: 104160,
  reported_start: '2026-11-03', reported_end: null, created_at: '2026-10-01T00:00:00Z', ...over,
});

const caller = () => appRouter.createCaller({});
const quote = { cash: 1302, points: 104160, start: '2026-11-03', end: null };
const submitInput = {
  subjectType: 'flight' as const, subjectKey: 'JFK-LHR', optionKey: 'chase', optionName: 'Chase Travel',
  quote,
};

beforeEach(() => {
  vi.clearAllMocks();
  flagState.enabled = true;
});

describe('reports.list', () => {
  it('groups by option and marks the viewer\'s own rows without exposing user ids', async () => {
    setup('u-me', [{ data: [row(), row({ id: 'r2', user_id: 'u-me' }), row({ id: 'r3', option_key: 'amex' })], error: null }]);
    const out = await caller().reports.list({ subjectType: 'flight', subjectKey: 'JFK-LHR' });
    expect(Object.keys(out).sort()).toEqual(['amex', 'chase']);
    expect(out.chase.map(r => r.isMine)).toEqual([false, true]);
    expect(out.chase[0]).not.toHaveProperty('user_id');
    expect(out.chase[0].quotedCash).toBe(1302);
  });

  it('works signed out — nothing is mine', async () => {
    setup(null, [{ data: [row({ user_id: 'u-me' })], error: null }]);
    const out = await caller().reports.list({ subjectType: 'flight', subjectKey: 'JFK-LHR' });
    expect(out.chase[0].isMine).toBe(false);
  });

  it('NOT_FOUND when the flag is off', async () => {
    flagState.enabled = false;
    await expect(caller().reports.list({ subjectType: 'flight', subjectKey: 'x' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('reports.submit', () => {
  it('UNAUTHORIZED when signed out', async () => {
    setup(null, []);
    await expect(caller().reports.submit({ ...submitInput, entered: quote }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('recomputes the result server-side and snapshots the display name', async () => {
    const { builders } = setup('u-me', [
      { data: { display_name: 'Nina R' }, error: null },
      { data: row({ user_id: 'u-me', result: 'different', reported_cash: '1350' }), error: null },
    ]);
    const out = await caller().reports.submit({ ...submitInput, entered: { ...quote, cash: 1350 } });
    const insert = builders[1].insert as ReturnType<typeof vi.fn>;
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u-me', reporter_name: 'Nina R', result: 'different', reported_cash: 1350,
    }));
    expect(out.isMine).toBe(true);
  });

  it('not found stores no reported values', async () => {
    const { builders } = setup('u-me', [
      { data: { display_name: null }, error: null },
      { data: row({ user_id: 'u-me', result: 'not_found', reported_cash: null }), error: null },
    ]);
    await caller().reports.submit({ ...submitInput, entered: null });
    expect(builders[1].insert).toHaveBeenCalledWith(expect.objectContaining({
      reporter_name: 'Traveler', result: 'not_found', reported_cash: null, reported_start: null,
    }));
  });

  it('rejects malformed dates', async () => {
    setup('u-me', []);
    await expect(caller().reports.submit({ ...submitInput, entered: { ...quote, start: '11/03/2026' } }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
