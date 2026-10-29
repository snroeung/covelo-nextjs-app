import { vi, beforeEach, describe, it, expect } from 'vitest';
import { makeDb, eqValue, type Handler, type Query } from './utils/fakeDb';
import { ADMIN, ME, OFFER1, P1, T_TRANSFER, TOPICS, ago, HOUR } from './utils/fixtures';

// The offer editor's save (offers.admin.*) keeps the covelo board post in step.
// Both the session client (catalog writes) and the service client (board writes)
// are the same recording fake, so one test sees the order of everything.

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: () => true }));

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { redis } from '@/lib/redis';
import { appRouter } from '@/server/routers/_app';

const payload = (q: Query) => q.payload as Record<string, unknown>;

const offerRow = (over: Record<string, unknown> = {}) => ({
  id: OFFER1, issuer: 'bilt', transfer_partner: 'World of Hyatt', bonus_pct: 30, end_date: '2026-11-30', active: true,
  post_to_board: false, board_topic: null, board_post_title: null, board_post_body: null, ...over,
});

/** `saved` = the transfer_bonuses row Postgres hands back after the write. */
function setup(saved: Record<string, unknown>, over: Record<string, Handler> = {}) {
  const db = makeDb({
    transfer_bonuses: (q) => (q.action === 'insert' || q.action === 'update' ? { data: saved } : undefined),
    board_posts: (q) => (q.action === 'insert' ? { data: { id: P1 } } : q.action === 'select' ? { data: [] } : undefined),
    board_topics: () => ({ data: TOPICS }),
    ...over,
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ADMIN, app_metadata: { role: 'admin' } } }, error: null }) },
    from: db.client.from,
  } as never);
  vi.mocked(getSupabaseAdmin).mockReturnValue(db.client as never);
  return db;
}
const boardCalls = (db: ReturnType<typeof setup>) => db.log.filter((q) => q.table.startsWith('board_'));
const caller = () => appRouter.createCaller({});

const base = { issuer: 'bilt' as const, transfer_partner: 'World of Hyatt', bonus_pct: 30, start_date: '2026-10-01', end_date: '2026-11-30' };
const board = { post_to_board: true, board_topic: 'Transfer bonuses', board_post_title: 'Bilt → Hyatt +30%', board_post_body: 'Instant.' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.del).mockResolvedValue(1);
});

describe('createTransferBonus', () => {
  it('saves the board fields with the offer, then creates covelo\'s post as the acting admin', async () => {
    const db = setup(offerRow(board));
    await caller().offers.admin.createTransferBonus({ ...base, ...board });

    expect(payload(db.of('transfer_bonuses', 'insert')[0])).toMatchObject(board);
    expect(payload(db.of('board_posts', 'insert')[0])).toMatchObject({
      is_system: true, author_id: null, offer_table: 'transfer_bonuses', offer_id: OFFER1,
      title: 'Bilt → Hyatt +30%', body: 'Instant.', topic_id: T_TRANSFER, verified_by: ADMIN,
    });
    // catalog first, board second
    expect(db.log.findIndex((q) => q.table === 'transfer_bonuses')).toBeLessThan(db.log.findIndex((q) => q.table === 'board_posts'));
  });

  it('leaves the board alone when the toggle is off — not a single board query', async () => {
    const db = setup(offerRow());
    await caller().offers.admin.createTransferBonus(base);
    expect(payload(db.of('transfer_bonuses', 'insert')[0])).toMatchObject({ post_to_board: false });
    expect(boardCalls(db)).toHaveLength(0);
  });

  it('refuses a missing title or topic before saving anything', async () => {
    const db = setup(offerRow());
    await expect(caller().offers.admin.createTransferBonus({ ...base, post_to_board: true, board_topic: 'Hotels' })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/title/) });
    await expect(caller().offers.admin.createTransferBonus({ ...base, post_to_board: true, board_post_title: 'T' })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/topic/) });
    expect(db.log).toHaveLength(0);
  });

  it('keeps the offer saved and reports the board failure instead of failing the mutation', async () => {
    const db = setup(offerRow({ ...board, board_topic: 'No such topic' }));
    await expect(caller().offers.admin.createTransferBonus({ ...base, ...board, board_topic: 'No such topic' }))
      .resolves.toMatchObject({ board_sync_error: 'Offer saved, but not posted to the board: Unknown board topic "No such topic".' });
    expect(db.of('transfer_bonuses', 'insert')).toHaveLength(1);
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
  });
});

describe('updateTransferBonus', () => {
  it('re-syncs even when the toggle is untouched and the row\'s flag is off: a leftover post gets hidden', async () => {
    const db = setup(offerRow(), { board_posts: (q) => (q.action === 'select' ? { data: [{ id: P1, deleted_at: null }] } : undefined) });
    await caller().offers.admin.updateTransferBonus({ id: OFFER1, description: 'edited' } as never);
    expect(payload(db.of('board_posts', 'update')[0]).deleted_at).toEqual(expect.any(String));
  });

  it('turning the toggle off hides covelo\'s post', async () => {
    const db = setup(offerRow(), { board_posts: (q) => (q.action === 'select' ? { data: [{ id: P1, deleted_at: null }] } : undefined) });
    await caller().offers.admin.updateTransferBonus({ id: OFFER1, post_to_board: false });
    expect(payload(db.of('board_posts', 'update')[0]).deleted_at).toEqual(expect.any(String));
    expect(db.of('board_posts', 'delete')).toHaveLength(0);
  });

  it('turning it on revives the same post', async () => {
    const db = setup(offerRow(board), {
      board_posts: (q) => (q.action === 'select' ? { data: [{ id: P1, deleted_at: ago(HOUR) }] } : undefined),
      board_post_topics: (q) => (q.single ? { data: { topic_id: T_TRANSFER } } : undefined),
    });
    await caller().offers.admin.updateTransferBonus({ id: OFFER1, ...board });
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
    expect(payload(db.of('board_posts', 'update')[0])).toMatchObject({ deleted_at: null, title: 'Bilt → Hyatt +30%' });
    expect(eqValue(db.of('board_posts', 'update')[0], 'id')).toBe(P1);
  });

  it('an unrelated edit to an offer that is not posted only looks, and writes nothing on the board', async () => {
    const db = setup(offerRow());
    await caller().offers.admin.updateTransferBonus({ id: OFFER1, description: 'updated terms' });
    expect(boardCalls(db).filter((q) => q.action !== 'select')).toHaveLength(0);
  });

  it('an unrelated edit to a posted offer refreshes covelo\'s post from the stored text', async () => {
    const stored = offerRow({ ...board, board_post_title: 'Stored by an admin' });
    const db = setup(stored, {
      board_posts: (q) => (q.action === 'select' ? { data: [{ id: P1, deleted_at: null }] } : undefined),
      board_post_topics: (q) => (q.single ? { data: { topic_id: T_TRANSFER } } : undefined),
    });
    await caller().offers.admin.updateTransferBonus({ id: OFFER1, bonus_pct: 35 });
    expect(payload(db.of('board_posts', 'update')[0])).toMatchObject({ title: 'Stored by an admin' });
  });

  it('refuses "post it" without a title and topic in the same request, saving nothing', async () => {
    const db = setup(offerRow());
    await expect(caller().offers.admin.updateTransferBonus({ id: OFFER1, post_to_board: true })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.log).toHaveLength(0);
  });
});

describe('spending bonuses', () => {
  const spendingRow = { id: OFFER1, issuer: 'chase', merchant_name: 'Delta', bonus_multiplier: 75, bonus_type: 'dollar_amount', end_date: '2026-10-31', ...board };

  it('create and update sync against the spending table', async () => {
    const db = setup(offerRow(), {
      spending_bonuses: (q) => (q.action === 'insert' || q.action === 'update' ? { data: spendingRow } : undefined),
    });
    await caller().offers.admin.createSpendingBonus({
      issuer: 'chase', merchant_name: 'Delta', bonus_multiplier: 75, bonus_type: 'dollar_amount', card_ids: [], start_date: '2026-10-01', end_date: '2026-10-31', ...board,
    });
    expect(payload(db.of('board_posts', 'insert')[0])).toMatchObject({ offer_table: 'spending_bonuses' });

    await caller().offers.admin.updateSpendingBonus({ id: OFFER1, post_to_board: false });
    expect(eqValue(db.of('board_posts', 'select').at(-1)!, 'offer_table')).toBe('spending_bonuses');
  });
});

// The session client the offer router uses is separate from the board's service client
it('uses the signed-in admin\'s id for verification, not a constant', async () => {
  const db = setup(offerRow(board));
  await caller().offers.admin.createTransferBonus({ ...base, ...board });
  expect(payload(db.of('board_posts', 'insert')[0]).verified_by).toBe(ADMIN);
  expect(payload(db.of('board_posts', 'insert')[0]).verified_by).not.toBe(ME);
});
