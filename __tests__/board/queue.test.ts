import { vi, beforeEach, describe, it, expect } from 'vitest';
import { makeDb, called, eqValue, type Handler, type Query } from './utils/fakeDb';
import { uuid, ME, OTHER, ADMIN, P1, C1, MO1, OFFER1, HOUR, ago, feedRow, commentRow } from './utils/fixtures';

// The board's rows in the shared Pending review queue: portalData.admin.listAll
// / approve / reject. Two fakes — the admin's session client (reads, gated by
// migration 031's policies) and the service-role client (every write) — so a
// test can see which one did what.

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
const flags = vi.hoisted(() => ({ board: true }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: (flag: string) => (flag === 'api:board' ? flags.board : true) }));

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { redis } from '@/lib/redis';
import { appRouter } from '@/server/routers/_app';

const payload = (q: Query) => q.payload as Record<string, unknown>;
const caller = () => appRouter.createCaller({});
const queue = () => caller().portalData.admin;

function asUser(id: string | null, admin = false) {
  return id ? { id, created_at: ago(400 * 24 * HOUR), app_metadata: admin ? { role: 'admin' } : {}, user_metadata: {} } : null;
}

/** `session` = what the admin's own client can read; `service` = the write path. */
function setup(session: Record<string, Handler> = {}, service: Record<string, Handler> = {}, user = asUser(ADMIN, true)) {
  const sessionDb = makeDb({
    transfer_partners: () => ({ data: [] }), travel_collections: () => ({ data: [] }), transfer_bonuses: () => ({ data: [] }),
    spending_bonuses: () => ({ data: [] }), points_valuations: () => ({ data: [] }),
    board_posts_feed: () => ({ data: [] }), board_comments: () => ({ data: [] }), profiles: () => ({ data: [] }),
    ...session,
  });
  const serviceDb = makeDb({ board_reports: () => ({ data: [], count: 0 }), ...service });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no session' } }) },
    from: sessionDb.client.from,
  } as never);
  vi.mocked(getSupabaseAdmin).mockReturnValue(serviceDb.client as never);
  return { sessionDb, serviceDb };
}

const boardTables = (db: { log: Query[] }) => db.log.filter((q) => q.table.startsWith('board_'));

beforeEach(() => {
  vi.clearAllMocks();
  flags.board = true;
  vi.mocked(redis.del).mockResolvedValue(1);
});

// ─── listAll ─────────────────────────────────────────────────────────────────

describe('listAll — board rows', () => {
  const PENDING_OFFER = uuid(212), HELD_POST = uuid(210), HELD_COMMENT = uuid(310);

  const board: Record<string, Handler> = {
    board_posts_feed: () => ({ data: [
      feedRow({ id: PENDING_OFFER, kind: 'offer', review: 'pending', member_offer_id: MO1, title: 'Virgin 25%', author_name: 'biltbear' }),
      feedRow({ id: HELD_POST, mod_status: 'held', mod_reasons: ['soft_blocklist'], title: 'Held tip' }),
    ] }),
    board_comments: () => ({ data: [commentRow({ id: HELD_COMMENT, mod_status: 'held', mod_reasons: ['toxicity'], author_id: ME })] }),
    profiles: () => ({ data: [{ id: ME, display_name: 'wanderyne' }] }),
  };

  it('adds offer posts to verify and held posts and comments after the catalog rows', async () => {
    setup({ ...board, spending_bonuses: () => ({ data: [{ id: 'sb-1', status: 'pending' }] }) });
    const rows = await queue().listAll();

    expect(rows.map((r) => r.table)).toEqual(['spending_bonuses', 'board_posts', 'board_posts', 'board_comments']);
    expect(rows[0]).toEqual({ table: 'spending_bonuses', row: { id: 'sb-1', status: 'pending' } }); // catalog rows untouched
  });

  it('says why each row is there, and names comment authors', async () => {
    setup(board);
    const rows = await queue().listAll();
    const by = Object.fromEntries(rows.map((r) => [r.row.id as string, r.row]));

    expect(by[PENDING_OFFER]).toMatchObject({ queue_reason: 'offer_review', title: 'Virgin 25%', author_name: 'biltbear', review: 'pending' });
    expect(by[HELD_POST]).toMatchObject({ queue_reason: 'held', mod_reasons: ['soft_blocklist'] });
    expect(by[HELD_COMMENT]).toMatchObject({ queue_reason: 'held', author_name: 'wanderyne', mod_reasons: ['toxicity'] });
  });

  it('adds public posts and comments with open reports, once each, with their tally', async () => {
    const REPORTED_TIP = uuid(220), REPORTED_COMMENT = uuid(320);
    const { sessionDb } = setup({
      ...board,
      board_reports: () => ({ data: [
        { target_kind: 'post', target_id: REPORTED_TIP, reason: 'Spam' },
        { target_kind: 'post', target_id: REPORTED_TIP, reason: 'Offensive' },
        { target_kind: 'post', target_id: HELD_POST, reason: 'Spam' },
        { target_kind: 'comment', target_id: REPORTED_COMMENT, reason: 'Off-topic' },
      ] }),
      board_posts_feed: (q) => (q.calls.some((c) => c[0] === 'in' && c[1][0] === 'id')
        ? { data: [feedRow({ id: REPORTED_TIP, title: 'Reported tip' }), feedRow({ id: HELD_POST, mod_status: 'held', title: 'Held tip' })] }
        : board.board_posts_feed(q)),
      board_comments: (q) => (q.calls.some((c) => c[0] === 'in' && c[1][0] === 'id')
        ? { data: [commentRow({ id: REPORTED_COMMENT, author_id: ME })] }
        : board.board_comments(q)),
    });
    const rows = await queue().listAll();
    const by = Object.fromEntries(rows.filter((r) => r.table.startsWith('board_')).map((r) => [r.row.id as string, r.row]));

    expect(by[REPORTED_TIP]).toMatchObject({ queue_reason: 'reported', report_count: 2, report_reasons: ['Spam', 'Offensive'] });
    expect(by[REPORTED_COMMENT]).toMatchObject({ queue_reason: 'reported', report_count: 1, author_name: 'wanderyne' });
    // Already in the queue as held: listed once, and the report count rides along
    expect(rows.filter((r) => r.row.id === HELD_POST)).toHaveLength(1);
    expect(by[HELD_POST]).toMatchObject({ queue_reason: 'held', report_count: 1 });
    expect(sessionDb.of('board_posts_feed')).toHaveLength(2);
  });

  it('names each post\'s topics, primary first, for Review & publish', async () => {
    setup({
      ...board,
      board_posts_feed: () => ({ data: [feedRow({ id: PENDING_OFFER, kind: 'offer', review: 'pending', member_offer_id: MO1, topic_id: uuid(2), topic_ids: [uuid(1), uuid(2)] })] }),
      board_topics: () => ({ data: [{ id: uuid(1), name: 'Hotels' }, { id: uuid(2), name: 'Transfer bonuses' }] }),
    });
    const row = (await queue().listAll()).find((r) => r.row.id === PENDING_OFFER)!;
    expect(row.row.topics).toEqual([{ id: uuid(2), name: 'Transfer bonuses' }, { id: uuid(1), name: 'Hotels' }]);
  });

  it('attaches the member-created offer to its post, for Review & publish', async () => {
    setup({ ...board, board_member_offers: () => ({ data: [{ id: MO1, name: 'Amex → Virgin 25%', details: { kind: 'transfer' } }] }) });
    const rows = await queue().listAll();
    const offer = rows.find((r) => r.row.id === PENDING_OFFER)!;
    expect(offer.row.member_offer).toMatchObject({ id: MO1, name: 'Amex → Virgin 25%' });
    expect(rows.find((r) => r.row.id === HELD_POST)!.row.member_offer).toBeNull();
  });

  it('board rows carry no `status`, so the existing table — which lists status = pending — does not show them yet', async () => {
    setup(board);
    const boardRows = (await queue().listAll()).filter((r) => r.table.startsWith('board_'));
    expect(boardRows).toHaveLength(3);
    expect(boardRows.every((r) => r.row.status === undefined)).toBe(true);
  });

  it('reads with the admin\'s own session — the board has no special access path — and never touches the service role', async () => {
    const { sessionDb } = setup(board);
    await queue().listAll();
    expect(boardTables(sessionDb).map((q) => q.table).sort()).toEqual(['board_comments', 'board_member_offers', 'board_posts_feed', 'board_reports', 'board_topics']);
    expect(vi.mocked(getSupabaseAdmin)).not.toHaveBeenCalled();
  });

  it('asks only for live content: held, or a still-public offer waiting for verification', async () => {
    const { sessionDb } = setup(board);
    await queue().listAll();
    const posts = sessionDb.of('board_posts_feed')[0];
    expect(called(posts, 'is', 'deleted_at', null)).toBe(true);
    expect(posts.calls.find((c) => c[0] === 'or')![1][0]).toBe('mod_status.eq.held,and(kind.eq.offer,review.eq.pending,mod_status.in.(clean,unscanned))');
    const comments = sessionDb.of('board_comments')[0];
    expect(called(comments, 'eq', 'mod_status', 'held')).toBe(true);
    expect(called(comments, 'is', 'deleted_at', null)).toBe(true);
  });

  it('adds no board query at all when the board API is off', async () => {
    flags.board = false;
    const { sessionDb } = setup(board, {});
    const rows = await queue().listAll();
    expect(boardTables(sessionDb)).toHaveLength(0);
    expect(rows.every((r) => !r.table.startsWith('board_'))).toBe(true);
  });

  it('keeps the catalog rows when the board read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setup({
      spending_bonuses: () => ({ data: [{ id: 'sb-1', status: 'pending' }] }),
      board_posts_feed: () => ({ error: { message: 'permission denied' } }),
      board_comments: () => ({ error: { message: 'permission denied' } }),
    });
    await expect(queue().listAll()).resolves.toEqual([{ table: 'spending_bonuses', row: { id: 'sb-1', status: 'pending' } }]);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('skips the author lookup when no comment is held', async () => {
    const { sessionDb } = setup({ board_posts_feed: () => ({ data: [] }) });
    await queue().listAll();
    expect(sessionDb.of('profiles')).toHaveLength(0);
  });
});

// ─── approve ─────────────────────────────────────────────────────────────────

describe('approve — board rows', () => {
  const post = (over: Record<string, unknown> = {}) => ({ board_posts_feed: () => ({ data: feedRow({ kind: 'offer', review: 'pending', offer_table: 'transfer_bonuses', offer_id: OFFER1, ...over }) }) });
  const heldTarget = (table: 'board_posts' | 'board_comments', status = 'held'): Record<string, Handler> => ({
    [table]: (q) => (q.single ? { data: { id: P1, author_id: OTHER, mod_status: status, deleted_at: null } } : undefined),
  });

  it('verifies an offer post that links a catalog offer, recording which admin did it', async () => {
    const { serviceDb } = setup({}, post());
    await queue().approve({ table: 'board_posts', id: P1 });
    expect(payload(serviceDb.of('board_posts', 'update')[0])).toMatchObject({ review: 'approved', verified_by: ADMIN, verified_at: expect.any(String), reject_reason: null });
  });

  it('refuses a member-created offer and points at Publish', async () => {
    const { serviceDb } = setup({}, post({ offer_table: null, offer_id: null, member_offer_id: MO1 }));
    await expect(queue().approve({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/reviewed and published/) });
    expect(serviceDb.of('board_posts', 'update')).toHaveLength(0);
  });

  it.each([
    ['already verified', { review: 'approved' }],
    ['a tip', { kind: 'tip', review: null }],
  ])('with %s and no open reports, there is nothing to approve', async (_name, over) => {
    // Public and unreported: the only thing approve could do is dismiss reports, and there are none
    setup({}, { ...post(over), ...heldTarget('board_posts', 'clean') });
    await expect(queue().approve({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/no open reports/) });
  });

  it('dismisses the reports on a reported public tip and leaves it up', async () => {
    const { serviceDb } = setup({}, {
      ...post({ kind: 'tip', review: null }), ...heldTarget('board_posts', 'clean'),
      board_reports: (q) => (q.head ? { data: null, count: 2 } : undefined),
    });
    await queue().approve({ table: 'board_posts', id: P1 });
    expect(payload(serviceDb.of('board_reports', 'update')[0])).toMatchObject({ resolved_by: ADMIN });
    expect(payload(serviceDb.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'dismiss_reports', actor_id: ADMIN });
    expect(serviceDb.of('board_posts', 'update')).toHaveLength(0);
  });

  it('dismisses the reports on a reported public comment', async () => {
    const { serviceDb } = setup({}, {
      ...heldTarget('board_comments', 'clean'),
      board_reports: (q) => (q.head ? { data: null, count: 1 } : undefined),
    });
    await queue().approve({ table: 'board_comments', id: C1 });
    expect(payload(serviceDb.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'dismiss_reports' });
    expect(serviceDb.of('board_comments', 'update')).toHaveLength(0);
  });

  it('releases a held post, settles its reports, and audits it', async () => {
    const { serviceDb } = setup({}, { ...post({ mod_status: 'held' }), ...heldTarget('board_posts') });
    await queue().approve({ table: 'board_posts', id: P1 });

    expect(payload(serviceDb.of('board_posts', 'update')[0])).toEqual({ mod_status: 'clean', mod_reasons: [] });
    expect(payload(serviceDb.of('board_reports', 'update')[0])).toMatchObject({ resolved_by: ADMIN });
    expect(payload(serviceDb.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'approve_held', actor_id: ADMIN });
  });

  it('releases a held comment', async () => {
    const { serviceDb } = setup({}, heldTarget('board_comments'));
    await queue().approve({ table: 'board_comments', id: C1 });
    expect(payload(serviceDb.of('board_comments', 'update')[0])).toEqual({ mod_status: 'clean', mod_reasons: [] });
  });

  it('404s content that is gone', async () => {
    setup({}, { board_posts_feed: () => ({ data: null }) });
    await expect(queue().approve({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    setup({}, post({ deleted_at: ago(HOUR) }));
    await expect(queue().approve({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('writes with the service role only — the admin session client is never asked to write', async () => {
    const { sessionDb } = setup({}, post());
    await queue().approve({ table: 'board_posts', id: P1 });
    expect(sessionDb.log).toHaveLength(0);
  });

  it('is gone when the board API is off', async () => {
    flags.board = false;
    setup();
    await expect(queue().approve({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(queue().approve({ table: 'board_comments', id: C1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('is for admins only', async () => {
    setup({}, post(), asUser(ME));
    await expect(queue().approve({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    setup({}, post(), null);
    await expect(queue().approve({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('validates the id', async () => {
    setup();
    await expect(queue().approve({ table: 'board_posts', id: 'nope' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ─── reject ──────────────────────────────────────────────────────────────────

describe('reject — board rows', () => {
  const post = (over: Record<string, unknown> = {}) => ({ board_posts_feed: () => ({ data: feedRow({ kind: 'offer', review: 'pending', ...over }) }) });
  const target = (table: 'board_posts' | 'board_comments'): Record<string, Handler> => ({
    [table]: (q) => (q.single ? { data: { id: P1, author_id: OTHER, mod_status: 'held', deleted_at: null } } : undefined),
  });

  it('rejects an offer post with a reason the author will see', async () => {
    const { serviceDb } = setup({}, post());
    await queue().reject({ table: 'board_posts', id: P1, reason: 'Offer expired' });
    expect(payload(serviceDb.of('board_posts', 'update')[0])).toEqual({ review: 'rejected', reject_reason: 'Offer expired', verified_by: null, verified_at: null });
  });

  it('requires a reason', async () => {
    const { serviceDb } = setup({}, post());
    await expect(queue().reject({ table: 'board_posts', id: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/Pick a reason/) });
    expect(serviceDb.of('board_posts', 'update')).toHaveLength(0);
  });

  it('only accepts a reason from the right list: rejection reasons for offers, removal reasons for held content', async () => {
    setup({}, post());
    // "Offensive" is a removal reason, not a rejection reason
    await expect(queue().reject({ table: 'board_posts', id: P1, reason: 'Offensive' })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/isn't a rejection reason/) });
    // "Can't confirm terms" is a rejection reason, not a removal reason
    setup({}, { ...post({ mod_status: 'held' }), ...target('board_posts') });
    await expect(queue().reject({ table: 'board_posts', id: P1, reason: "Can't confirm terms" })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/isn't a removal reason/) });
  });

  it('takes held content down — the removal, its reports and an audit event', async () => {
    const { serviceDb } = setup({}, { ...post({ mod_status: 'held' }), ...target('board_posts') });
    await queue().reject({ table: 'board_posts', id: P1, reason: 'Spam' });

    expect(payload(serviceDb.of('board_posts', 'update')[0])).toMatchObject({ mod_status: 'removed', removed_by: ADMIN, removed_reason: 'Spam' });
    expect(payload(serviceDb.of('board_reports', 'update')[0])).toMatchObject({ resolved_by: ADMIN });
    expect(payload(serviceDb.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'take_down', reasons: ['Spam'] });
  });

  it('takes a held comment down', async () => {
    const { serviceDb } = setup({}, target('board_comments'));
    await queue().reject({ table: 'board_comments', id: C1, reason: 'Offensive' });
    expect(payload(serviceDb.of('board_comments', 'update')[0])).toMatchObject({ mod_status: 'removed', removed_reason: 'Offensive' });
  });

  it('takes a reported public tip down with a removal reason', async () => {
    const { serviceDb } = setup({}, {
      ...post({ kind: 'tip', review: null }),
      board_posts: (q) => (q.single ? { data: { id: P1, author_id: OTHER, mod_status: 'clean', deleted_at: null } } : undefined),
    });
    await queue().reject({ table: 'board_posts', id: P1, reason: 'Spam' });
    expect(payload(serviceDb.of('board_posts', 'update')[0])).toMatchObject({ mod_status: 'removed', removed_by: ADMIN, removed_reason: 'Spam' });
    expect(payload(serviceDb.of('board_reports', 'update')[0])).toMatchObject({ resolved_by: ADMIN });
  });

  it('wants a removal reason, not a rejection reason, for a reported tip', async () => {
    setup({}, post({ kind: 'tip', review: null }));
    // "Can't confirm terms" belongs to offer rejections only
    await expect(queue().reject({ table: 'board_posts', id: P1, reason: "Can't confirm terms" })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/isn't a removal reason/) });
  });

  it('refuses an offer that was already rejected', async () => {
    setup({}, post({ review: 'rejected' }));
    await expect(queue().reject({ table: 'board_posts', id: P1, reason: 'Offer expired' })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Already rejected.' });
  });

  it('is gone when the board API is off', async () => {
    flags.board = false;
    setup();
    await expect(queue().reject({ table: 'board_posts', id: P1, reason: 'Spam' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('leaves catalog rejection exactly as it was — a reason is ignored, not required', async () => {
    const { sessionDb } = setup({ travel_collections: () => ({ data: null }) });
    await queue().reject({ table: 'travel_collections', id: P1 });
    expect(payload(sessionDb.of('travel_collections', 'update')[0])).toEqual({ status: 'rejected' });
    expect(eqValue(sessionDb.of('travel_collections', 'update')[0], 'id')).toBe(P1);
    expect(vi.mocked(getSupabaseAdmin)).not.toHaveBeenCalled();
  });
});
