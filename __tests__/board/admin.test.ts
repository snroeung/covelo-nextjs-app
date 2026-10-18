import { vi, beforeEach, describe, it, expect } from 'vitest';
import { makeDb, arg, called, eqValue, type Handler, type Query } from './utils/fakeDb';
import {
  uuid, ME, OTHER, ADMIN, T_TRANSFER, T_HOTEL, T_AWARD, P1, C1, OFFER1, MO1,
  topic, TOPICS, HOUR, ago, feedRow, commentRow,
} from './utils/fixtures';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
const flagState = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: () => flagState.enabled }));

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { redis } from '@/lib/redis';
import { appRouter } from '@/server/routers/_app';

// ─── Setup ───────────────────────────────────────────────────────────────────

function asUser(id: string | null, admin = false) {
  const user = id ? { id, created_at: ago(400 * 24 * HOUR), app_metadata: admin ? { role: 'admin' } : {}, user_metadata: {} } : null;
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no session' } }) },
  } as never);
}

function mockDb(over: Record<string, Handler> = {}, rpcs: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  const db = makeDb(
    {
      profiles: () => ({ data: [] }),
      board_topics: () => ({ data: TOPICS }),
      board_posts_feed: () => ({ data: feedRow() }),
      ...over,
    },
    rpcs,
  );
  vi.mocked(getSupabaseAdmin).mockReturnValue(db.client as never);
  return db;
}

const caller = () => appRouter.createCaller({});
const admin = () => caller().board.admin;
const payload = (q: Query) => q.payload as Record<string, unknown>;

/** A post/comment row as the moderation lookup reads it. */
const target = (over: Record<string, unknown> = {}) => ({ id: P1, author_id: OTHER, mod_status: 'clean', deleted_at: null, ...over });
const lookup = (row: Record<string, unknown> | null): Handler => (q) => (q.single ? { data: row } : undefined);

beforeEach(() => {
  vi.clearAllMocks();
  flagState.enabled = true;
  vi.mocked(redis.del).mockResolvedValue(1);
  asUser(ADMIN, true);
});

// ─── Access ──────────────────────────────────────────────────────────────────

describe('admin access', () => {
  const calls: Array<[string, () => Promise<unknown>]> = [
    ['dismissReports', () => admin().dismissReports({ kind: 'post', id: P1 })],
    ['modFeed', () => admin().modFeed({})],
    ['approve', () => admin().approve({ postId: P1 })],
    ['takeDown', () => admin().takeDown({ kind: 'post', id: P1, reason: 'Spam' })],
    ['bulk', () => admin().bulk({ action: 'restore', kind: 'post', ids: [P1] })],
    ['setStanding', () => admin().setStanding({ userId: OTHER, standing: 'banned' })],
    ['topics.merge', () => admin().topics.merge({ sourceId: T_HOTEL, targetId: T_AWARD })],
    ['blockedTerms.list', () => admin().blockedTerms.list()],
    ['rescan', () => admin().rescan({ days: 7 })],
  ];

  it.each(calls)('%s is forbidden to members', async (_name, run) => {
    asUser(ME);
    mockDb();
    await expect(run()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it.each(calls)('%s needs a session', async (_name, run) => {
    asUser(null);
    mockDb();
    await expect(run()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('is gone when api:board is off', async () => {
    flagState.enabled = false;
    await expect(admin().modFeed({})).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ─── Mod view ────────────────────────────────────────────────────────────────

describe('admin.modFeed', () => {
  it('lists held and removed posts, bypassing the member visibility filter, with full moderation detail', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: [feedRow({ mod_status: 'removed', removed_reason: 'Spam', mod_reasons: ['reports'] })] }) });
    const out = await admin().modFeed({});
    const q = db.of('board_posts_feed').find((x) => !x.head)!;
    expect(called(q, 'in', 'mod_status', ['held', 'removed'])).toBe(true);
    expect(q.calls.some((c) => c[0] === 'or')).toBe(false);
    expect(out.posts[0]).toMatchObject({ notice: { kind: 'removed', reason: 'Spam' }, mod: { status: 'removed', removedReason: 'Spam' } });
  });

  it('narrows to one status and kind', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: [] }) });
    await admin().modFeed({ status: 'held', type: 'offer' });
    const q = db.of('board_posts_feed').find((x) => !x.head)!;
    expect(called(q, 'in', 'mod_status', ['held'])).toBe(true);
    expect(called(q, 'eq', 'kind', 'offer')).toBe(true);
  });

  describe('reported', () => {
    const POST_A = uuid(221), POST_B = uuid(222), POST_C = uuid(223), COMMENT_B = uuid(321), COMMENT_HELD = uuid(322);

    const reports = [
      { target_kind: 'post', target_id: POST_A, reason: 'Spam' },
      { target_kind: 'post', target_id: POST_A, reason: 'Offensive' },
      { target_kind: 'comment', target_id: COMMENT_B, reason: 'Off-topic' },
      { target_kind: 'comment', target_id: COMMENT_B, reason: 'Off-topic' },
      { target_kind: 'comment', target_id: COMMENT_B, reason: 'Spam' },
      { target_kind: 'comment', target_id: COMMENT_HELD, reason: 'Spam' },
      { target_kind: 'post', target_id: POST_C, reason: 'Spam' },
    ];

    /** open reports → comment lookup → feed → tallies for the hydrated posts */
    function reportedBoard(over: Record<string, Handler> = {}) {
      return mockDb({
        board_reports: (q) => {
          if (q.calls.some((c) => c[0] === 'in')) {
            // hydrate's per-page tally
            const kind = eqValue(q, 'target_kind');
            return { data: reports.filter((r) => r.target_kind === kind) };
          }
          return { data: reports };
        },
        board_comments: () => ({ data: [{ id: COMMENT_B, post_id: POST_B }] }), // the held comment is filtered out by the query
        board_posts_feed: () => ({ data: [feedRow({ id: POST_C }), feedRow({ id: POST_B }), feedRow({ id: POST_A })] }),
        ...over,
      });
    }

    it('lists public posts with open reports on the post or on a comment, most-reported first', async () => {
      reportedBoard();
      const out = await admin().modFeed({ status: 'reported' });
      expect(out.nextCursor).toBeNull();
      // POST_B: 3 on a comment · POST_A: 2 on the post · POST_C: 1 · the held comment's report is not a public item
      expect(out.posts.map((p) => p.id)).toEqual([POST_B, POST_A, POST_C]);
    });

    it('puts counts and reasons on `mod`, and splits comment reports out', async () => {
      reportedBoard();
      const out = await admin().modFeed({ status: 'reported' });
      const byId = Object.fromEntries(out.posts.map((p) => [p.id, p.mod]));
      expect(byId[POST_A]).toMatchObject({ reportCount: 2, reportReasons: ['Spam', 'Offensive'], reportedComments: 0 });
      expect(byId[POST_B]).toMatchObject({ reportCount: 0, reportedComments: 3 });
      expect(byId[POST_C]).toMatchObject({ reportCount: 1, reportReasons: ['Spam'] });
    });

    it('only asks for unresolved reports, public comments, and public posts', async () => {
      const db = reportedBoard();
      await admin().modFeed({ status: 'reported' });
      expect(called(db.of('board_reports')[0], 'is', 'resolved_at', null)).toBe(true);
      expect(called(db.of('board_comments')[0], 'in', 'mod_status', ['clean', 'unscanned'])).toBe(true);
      const feed = db.of('board_posts_feed').find((q) => !q.head)!;
      expect(called(feed, 'in', 'mod_status', ['clean', 'unscanned'])).toBe(true);
      const asked = feed.calls.find((c) => c[0] === 'in' && c[1][0] === 'id')![1][1] as string[];
      expect([...asked].sort()).toEqual([POST_A, POST_B, POST_C]);
    });

    it('is empty when nothing is reported', async () => {
      const db = reportedBoard({ board_reports: () => ({ data: [] }) });
      await expect(admin().modFeed({ status: 'reported' })).resolves.toEqual({ posts: [], nextCursor: null });
      expect(db.of('board_posts_feed')).toHaveLength(0);
    });

    it('applies the tip / offer filter', async () => {
      const db = reportedBoard();
      await admin().modFeed({ status: 'reported', type: 'offer' });
      expect(called(db.of('board_posts_feed').find((q) => !q.head)!, 'eq', 'kind', 'offer')).toBe(true);
    });

    it('caps the list at 100 posts', async () => {
      const many = Array.from({ length: 150 }, (_, i) => ({ target_kind: 'post', target_id: uuid(1000 + i), reason: 'Spam' }));
      const db = reportedBoard({ board_reports: () => ({ data: many }), board_posts_feed: () => ({ data: [] }) });
      await admin().modFeed({ status: 'reported' });
      const ids = db.of('board_posts_feed').find((q) => !q.head)!.calls.find((c) => c[0] === 'in' && c[1][0] === 'id')![1][1] as string[];
      expect(ids).toHaveLength(100);
    });
  });
});

// ─── Offer verification ──────────────────────────────────────────────────────

describe('approve / reject / bulkApprove', () => {
  const linked = (over: Record<string, unknown> = {}) => feedRow({ kind: 'offer', review: 'pending', offer_table: 'transfer_bonuses', offer_id: OFFER1, ...over });

  it('verifies a pending post that links a catalog offer, recording who and when', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: linked() }) });
    await expect(admin().approve({ postId: P1 })).resolves.toEqual({ ok: true });
    expect(payload(db.of('board_posts', 'update')[0])).toMatchObject({ review: 'approved', verified_by: ADMIN, verified_at: expect.any(String), reject_reason: null });
  });

  it.each([
    ['a member-created offer (needs the editor)', { member_offer_id: MO1, offer_id: null, offer_table: null }, /published/],
    ['an already verified post', { review: 'approved' }, /Already approved/],
    ['a rejected post', { review: 'rejected' }, /Already rejected/],
  ])('refuses %s', async (_name, patch, message) => {
    const db = mockDb({ board_posts_feed: () => ({ data: linked(patch) }) });
    await expect(admin().approve({ postId: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(message) });
    expect(db.of('board_posts', 'update')).toHaveLength(0);
  });

  it('refuses tips and missing posts', async () => {
    mockDb({ board_posts_feed: () => ({ data: feedRow() }) });
    await expect(admin().approve({ postId: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    mockDb({ board_posts_feed: () => ({ data: null }) });
    await expect(admin().approve({ postId: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    mockDb({ board_posts_feed: () => ({ data: linked({ deleted_at: ago(HOUR) }) }) });
    await expect(admin().approve({ postId: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects with the chosen reason, clearing verification', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: linked({ review: 'approved', verified_by: ADMIN, verified_at: ago(HOUR) }) }) });
    await admin().reject({ postId: P1, reason: 'Offer expired' });
    expect(payload(db.of('board_posts', 'update')[0])).toEqual({ review: 'rejected', reject_reason: 'Offer expired', verified_by: null, verified_at: null });
  });

  it('only accepts the shared reject reasons, and not twice', async () => {
    mockDb({ board_posts_feed: () => ({ data: linked() }) });
    await expect(admin().reject({ postId: P1, reason: 'Because' as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    mockDb({ board_posts_feed: () => ({ data: linked({ review: 'rejected' }) }) });
    await expect(admin().reject({ postId: P1, reason: 'Off-topic' })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Already rejected.' });
  });

  it('bulk approves what it can and reports why it skipped the rest', async () => {
    const rows: Record<string, Record<string, unknown> | null> = {
      [uuid(1)]: linked({ id: uuid(1) }),
      [uuid(2)]: linked({ id: uuid(2), member_offer_id: MO1, offer_id: null, offer_table: null }),
      [uuid(3)]: linked({ id: uuid(3), review: 'approved' }),
      [uuid(4)]: null,
      [uuid(5)]: feedRow({ id: uuid(5) }),
    };
    const db = mockDb({ board_posts_feed: (q) => ({ data: rows[eqValue(q, 'id') as string] }) });
    const out = await admin().bulkApprove({ ids: Object.keys(rows) });
    expect(out.approved).toEqual([uuid(1)]);
    expect(Object.fromEntries(out.skipped.map((s) => [s.id, s.reason]))).toEqual({
      [uuid(2)]: 'A member-created offer must be reviewed and published.',
      [uuid(3)]: 'Already approved.',
      [uuid(4)]: 'Post not found.',
      [uuid(5)]: 'Not an offer post.',
    });
    expect(db.of('board_posts', 'update')).toHaveLength(1);
  });

  it('caps a bulk call at 100 ids', async () => {
    mockDb();
    await expect(admin().bulkApprove({ ids: Array.from({ length: 101 }, (_, i) => uuid(1000 + i)) })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().bulkApprove({ ids: [] })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ─── Publish ─────────────────────────────────────────────────────────────────

describe('admin.publish', () => {
  const memberPost = feedRow({ kind: 'offer', review: 'pending', member_offer_id: MO1, author_id: OTHER, mod_status: 'unscanned' });
  const offer = {
    issuer: 'bilt' as const, transfer_partner: 'World of Hyatt', bonus_pct: 30, start_date: '2026-10-01', end_date: '2026-11-30',
    tags: [], is_targeted: false, for_status_transfer: false, card_ids: [], country: 'US', active: true, post_to_board: false,
  };
  const input = { postId: P1, table: 'transfer_bonuses' as const, offer };

  const publishDb = (over: Record<string, Handler> = {}) =>
    mockDb({
      board_posts_feed: () => ({ data: memberPost }),
      transfer_bonuses: (q) => (q.action === 'insert' ? { data: { id: OFFER1 } } : undefined),
      ...over,
    });

  it('adds the offer to the catalog, links the member offer, repoints and verifies the post', async () => {
    const db = publishDb();
    const out = await admin().publish(input);

    expect(out.offerId).toBe(OFFER1);
    expect(payload(db.of('transfer_bonuses', 'insert')[0])).toMatchObject({
      issuer: 'bilt', transfer_partner: 'World of Hyatt', bonus_pct: 30,
      source: 'member', status: 'approved', active: true, submitted_by: OTHER,
    });
    expect(payload(db.of('board_member_offers', 'update')[0])).toEqual({ published_table: 'transfer_bonuses', published_id: OFFER1 });
    expect(eqValue(db.of('board_member_offers', 'update')[0], 'id')).toBe(MO1);
    // one statement, so the post always has exactly one offer link
    expect(payload(db.of('board_posts', 'update')[0])).toMatchObject({
      offer_table: 'transfer_bonuses', offer_id: OFFER1, member_offer_id: null, review: 'approved', verified_by: ADMIN, reject_reason: null,
    });
    expect(db.of('board_posts', 'insert')).toHaveLength(0); // no covelo post unless asked
  });

  it('forces member/approved/active and ignores what the client claimed', async () => {
    const db = publishDb();
    await admin().publish({ ...input, offer: { ...offer, source: 'admin', status: 'pending', active: false } as never });
    expect(payload(db.of('transfer_bonuses', 'insert')[0])).toMatchObject({ source: 'member', status: 'approved', active: true });
  });

  it('also posts for covelo when asked, and busts the offers cache', async () => {
    const db = publishDb({ board_posts: (q) => (q.action === 'insert' ? { data: { id: uuid(900) } } : q.action === 'select' ? { data: [] } : undefined) });
    await admin().publish({ ...input, offer: { ...offer, post_to_board: true, board_topic: 'Transfer bonuses', board_post_title: 'Bilt → Hyatt +30%', board_post_body: 'One transfer.' } });
    expect(payload(db.of('board_posts', 'insert')[0])).toMatchObject({ is_system: true, author_id: null, offer_id: OFFER1, title: 'Bilt → Hyatt +30%', topic_id: T_TRANSFER });
    expect(redis.del).toHaveBeenCalledWith('offers:transfer-bonuses');
  });

  it('works for a spending bonus', async () => {
    const db = mockDb({
      board_posts_feed: () => ({ data: memberPost }),
      spending_bonuses: (q) => (q.action === 'insert' ? { data: { id: OFFER1 } } : undefined),
    });
    await admin().publish({
      postId: P1, table: 'spending_bonuses',
      offer: { issuer: 'chase', merchant_name: 'Delta', bonus_multiplier: 75, bonus_type: 'dollar_amount', card_ids: [], start_date: '2026-10-01', end_date: '2026-10-31' } as never,
    });
    expect(payload(db.of('spending_bonuses', 'insert')[0])).toMatchObject({ merchant_name: 'Delta', source: 'member' });
    expect(payload(db.of('board_posts', 'update')[0])).toMatchObject({ offer_table: 'spending_bonuses' });
    expect(redis.del).toHaveBeenCalledWith('offers:spending-bonuses');
  });

  it('refuses a post that already links a catalog offer, a tip, and a missing post — before writing anything', async () => {
    let db = mockDb({ board_posts_feed: () => ({ data: feedRow({ kind: 'offer', review: 'pending', offer_table: 'transfer_bonuses', offer_id: OFFER1 }) }) });
    await expect(admin().publish(input)).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/already links/) });
    db = mockDb({ board_posts_feed: () => ({ data: feedRow() }) });
    await expect(admin().publish(input)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.of('transfer_bonuses', 'insert')).toHaveLength(0);
    mockDb({ board_posts_feed: () => ({ data: null }) });
    await expect(admin().publish(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('checks the board title and topic before it saves anything', async () => {
    const db = publishDb();
    await expect(admin().publish({ ...input, offer: { ...offer, post_to_board: true, board_topic: 'Hotels' } })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/title/) });
    expect(db.of('transfer_bonuses', 'insert')).toHaveLength(0);
  });

  it('validates the offer fields', async () => {
    mockDb();
    await expect(admin().publish({ ...input, offer: { ...offer, bonus_pct: -5 } })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().publish({ ...input, offer: { ...offer, issuer: 'visa' as never } })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('undoes the catalog row if linking the member offer fails', async () => {
    const db = publishDb({ board_member_offers: () => ({ error: { message: 'link failed' } }) });
    await expect(admin().publish(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(eqValue(db.of('transfer_bonuses', 'delete')[0], 'id')).toBe(OFFER1);
    expect(db.of('board_posts', 'update')).toHaveLength(0);
  });

  it('undoes both the link and the catalog row if repointing the post fails', async () => {
    const db = publishDb({ board_posts: (q) => (q.action === 'update' ? { error: { message: 'post failed' } } : undefined) });
    await expect(admin().publish(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(db.of('board_member_offers', 'update').map(payload)).toEqual([
      { published_table: 'transfer_bonuses', published_id: OFFER1 },
      { published_table: null, published_id: null },
    ]);
    expect(db.of('transfer_bonuses', 'delete')).toHaveLength(1);
  });

  it('says so when the offer published but the covelo post could not be made', async () => {
    publishDb({ board_posts: (q) => (q.action === 'select' ? { data: [] } : undefined) });
    await expect(admin().publish({ ...input, offer: { ...offer, post_to_board: true, board_topic: 'No such topic', board_post_title: 'T' } }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/^Published, but not posted to the board: Unknown board topic/) });
  });
});

// ─── Take down / restore / approve held ─────────────────────────────────────

describe('takeDown / restore / approveHeld', () => {
  it.each([['post', 'board_posts'], ['comment', 'board_comments']] as const)('takes a %s down with a reason and audits it', async (kind, table) => {
    const db = mockDb({ [table]: lookup(target()) });
    await expect(admin().takeDown({ kind, id: P1, reason: 'Spam', note: 'link farm' })).resolves.toEqual({ ok: true });

    expect(payload(db.of(table, 'update')[0])).toEqual({
      mod_status: 'removed', removed_by: ADMIN, removed_at: expect.any(String), removed_reason: 'Spam', removed_note: 'link farm',
    });
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({
      target_kind: kind, target_id: P1, subject_user_id: OTHER, actor_id: ADMIN, action: 'take_down', reasons: ['Spam'], note: 'link farm',
    });
    // acting settles the open reports
    const settle = db.of('board_reports', 'update')[0];
    expect(payload(settle)).toMatchObject({ resolved_by: ADMIN });
    expect(eqValue(settle, 'target_id')).toBe(P1);
    expect(called(settle, 'is', 'resolved_at', null)).toBe(true);
    expect(redis.del).toHaveBeenCalledWith('board:topics');
  });

  it('only accepts the shared remove reasons, and 404s missing or deleted content', async () => {
    mockDb({ board_posts: lookup(target()) });
    await expect(admin().takeDown({ kind: 'post', id: P1, reason: 'Boring' as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    mockDb({ board_posts: lookup(null) });
    await expect(admin().takeDown({ kind: 'post', id: P1, reason: 'Spam' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    mockDb({ board_comments: lookup(target({ deleted_at: ago(HOUR) })) });
    await expect(admin().takeDown({ kind: 'comment', id: C1, reason: 'Spam' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Comment not found.' });
  });

  it('restores removed content to clean and clears the removal record', async () => {
    const db = mockDb({ board_posts: lookup(target({ mod_status: 'removed' })) });
    await admin().restore({ kind: 'post', id: P1 });
    expect(payload(db.of('board_posts', 'update')[0])).toEqual({
      mod_status: 'clean', mod_reasons: [], removed_by: null, removed_at: null, removed_reason: null, removed_note: null,
    });
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'restore' });
  });

  it('restore is only for removed content; approveHeld only for held', async () => {
    mockDb({ board_posts: lookup(target({ mod_status: 'clean' })) });
    await expect(admin().restore({ kind: 'post', id: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Only removed content can be restored.' });
    mockDb({ board_posts: lookup(target({ mod_status: 'removed' })) });
    await expect(admin().approveHeld({ kind: 'post', id: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Only held content can be approved.' });
  });

  it('approves held content: clean again, reports settled, audited', async () => {
    const db = mockDb({ board_comments: lookup(target({ mod_status: 'held' })) });
    await admin().approveHeld({ kind: 'comment', id: C1 });
    expect(payload(db.of('board_comments', 'update')[0])).toEqual({ mod_status: 'clean', mod_reasons: [] });
    expect(db.of('board_reports', 'update')).toHaveLength(1);
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({ target_kind: 'comment', action: 'approve_held' });
  });

  it('bulk applies one action to many, collecting failures instead of stopping', async () => {
    const rows: Record<string, Record<string, unknown>> = {
      [uuid(1)]: target({ id: uuid(1), mod_status: 'removed' }),
      [uuid(2)]: target({ id: uuid(2), mod_status: 'clean' }),
    };
    const db = mockDb({ board_posts: (q) => (q.single ? { data: rows[eqValue(q, 'id') as string] ?? null } : undefined) });
    const out = await admin().bulk({ action: 'restore', kind: 'post', ids: [uuid(1), uuid(2), uuid(3)] });
    expect(out.done).toEqual([uuid(1)]);
    expect(out.failed).toEqual([
      { id: uuid(2), message: 'Only removed content can be restored.' },
      { id: uuid(3), message: 'Post not found.' },
    ]);
    expect(db.of('board_posts', 'update')).toHaveLength(1);
  });

  it('bulk take-down needs a reason', async () => {
    mockDb();
    await expect(admin().bulk({ action: 'takeDown', kind: 'post', ids: [P1] })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const db = mockDb({ board_posts: lookup(target()) });
    const out = await admin().bulk({ action: 'takeDown', kind: 'post', ids: [P1], reason: 'Off-topic' });
    expect(out.done).toEqual([P1]);
    expect(payload(db.of('board_posts', 'update')[0])).toMatchObject({ removed_reason: 'Off-topic' });
  });
});

// ─── Topic / comments / standing ─────────────────────────────────────────────

describe('setTopic', () => {
  const withPrimary = (extra: Record<string, Handler> = {}) =>
    mockDb({
      board_posts_feed: () => ({ data: feedRow({ topic_id: T_HOTEL, mod_flags: ['topic_mismatch', 'borderline_topic'] }) }),
      board_post_topics: (q) => (q.single ? { data: { topic_id: T_HOTEL } } : undefined),
      ...extra,
    });

  it('makes the chosen topic primary, drops the old one, and clears the mismatch flag', async () => {
    const db = withPrimary();
    await admin().setTopic({ postId: P1, topicId: T_AWARD });
    const links = db.of('board_post_topics');
    expect(links.map((q) => q.action)).toEqual(['select', 'delete', 'upsert']);
    expect(eqValue(links[1], 'topic_id')).toBe(T_HOTEL);
    expect(links[2].payload).toEqual({ post_id: P1, topic_id: T_AWARD, is_primary: true });
    const updates = db.of('board_posts', 'update').map(payload);
    expect(updates).toEqual([{ topic_id: T_AWARD }, { mod_flags: ['borderline_topic'] }]);
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'set_topic', note: `${T_HOTEL} → ${T_AWARD}` });
  });

  it('follows a merged topic and refuses hidden or unknown ones', async () => {
    const mergedId = uuid(130), goneId = uuid(131);
    const db = withPrimary({
      board_topics: () => ({ data: [
        ...TOPICS,
        topic(mergedId, 'Lodging', 'lodging', { status: 'hidden', merged_into_id: T_AWARD }),
        topic(goneId, 'Gone', 'gone', { status: 'hidden' }),
      ] }),
    });
    await admin().setTopic({ postId: P1, topicId: mergedId });
    expect(db.of('board_post_topics', 'upsert')[0].payload).toMatchObject({ topic_id: T_AWARD });

    await expect(admin().setTopic({ postId: P1, topicId: goneId })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().setTopic({ postId: P1, topicId: uuid(999) })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.of('board_post_topics', 'upsert')).toHaveLength(1);
  });

  it('404s a missing post', async () => {
    mockDb({ board_posts_feed: () => ({ data: null }) });
    await expect(admin().setTopic({ postId: P1, topicId: T_AWARD })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('lockComments', () => {
  it('locks and unlocks, auditing each', async () => {
    const db = mockDb();
    await admin().lockComments({ postId: P1, locked: true });
    await admin().lockComments({ postId: P1, locked: false });
    expect(db.of('board_posts', 'update').map(payload)).toEqual([{ comments_locked: true }, { comments_locked: false }]);
    expect(db.of('board_mod_events', 'insert').map((q) => payload(q).action)).toEqual(['lock_comments', 'unlock_comments']);
  });

  it('404s a missing post', async () => {
    mockDb({ board_posts_feed: () => ({ data: null }) });
    await expect(admin().lockComments({ postId: P1, locked: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('setStanding', () => {
  it('restricts or bans through one flag row, recording the admin and note', async () => {
    const db = mockDb();
    await admin().setStanding({ userId: OTHER, standing: 'banned', note: 'spam ring' });
    expect(db.of('board_user_flags', 'upsert')[0].payload).toEqual({ user_id: OTHER, standing: 'banned', set_by: ADMIN, note: 'spam ring' });
    expect(arg(db.of('board_user_flags', 'upsert')[0], 'upsert', 1)).toEqual({ onConflict: 'user_id' });
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({ target_kind: 'user', action: 'set_standing', reasons: ['banned'], subject_user_id: OTHER });
  });

  it('"normal" clears the manual flag', async () => {
    const db = mockDb();
    await admin().setStanding({ userId: OTHER, standing: 'normal' });
    expect(eqValue(db.of('board_user_flags', 'delete')[0], 'user_id')).toBe(OTHER);
    expect(db.of('board_user_flags', 'upsert')).toHaveLength(0);
  });

  it('will not change the admin\'s own standing, and only accepts the three values', async () => {
    const db = mockDb();
    await expect(admin().setStanding({ userId: ADMIN, standing: 'banned' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().setStanding({ userId: OTHER, standing: 'watch' as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.of('board_user_flags')).toHaveLength(0);
  });
});

// ─── Topics ──────────────────────────────────────────────────────────────────

describe('topics.rename', () => {
  const T_LOUNGE = uuid(140);
  const topics = [...TOPICS, topic(T_LOUNGE, 'Lounges', 'lounge', { status: 'active' })];
  const withLounge = (extra: Record<string, Handler> = {}) =>
    mockDb({ board_topics: () => ({ data: topics }), board_topic_aliases: () => ({ data: [] }), ...extra });

  it('renames, keeps the old name resolving as an alias, and audits', async () => {
    const db = withLounge();
    await admin().topics.rename({ id: T_LOUNGE, name: 'airport lounge access' });
    expect(payload(db.of('board_topics', 'update')[0])).toEqual({ name: 'Airport lounge access', key: 'airport lounge access' });
    expect(db.of('board_topic_aliases', 'upsert')[0].payload).toEqual({ key: 'lounge', topic_id: T_LOUNGE });
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({ target_kind: 'topic', action: 'topic_rename', note: 'Lounges → Airport lounge access' });
    expect(redis.del).toHaveBeenCalledWith('board:topics');
  });

  it('a recase of the same key needs no alias', async () => {
    const db = withLounge();
    await admin().topics.rename({ id: T_LOUNGE, name: 'LOUNGES' });
    expect(payload(db.of('board_topics', 'update')[0])).toMatchObject({ key: 'lounge' });
    expect(db.of('board_topic_aliases', 'upsert')).toHaveLength(0);
  });

  it('refuses a name another topic already uses, directly or through an alias', async () => {
    let db = withLounge();
    await expect(admin().topics.rename({ id: T_LOUNGE, name: 'Hotels' })).rejects.toMatchObject({ code: 'CONFLICT', message: '"Hotels" already uses that name.' });
    db = withLounge({ board_topic_aliases: () => ({ data: [{ key: 'airport lounge access', topic_id: T_AWARD }] }) });
    await expect(admin().topics.rename({ id: T_LOUNGE, name: 'Airport lounge access' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.of('board_topics', 'update')).toHaveLength(0);
  });

  it('refuses invalid or offensive names and unknown topics', async () => {
    withLounge({ board_blocked_terms: () => ({ data: [{ term: 'zorblax', tier: 'hard' }] }) });
    await expect(admin().topics.rename({ id: T_LOUNGE, name: 'x' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().topics.rename({ id: T_LOUNGE, name: 'zorblax deals' })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'That topic name breaks the board rules.' });
    await expect(admin().topics.rename({ id: uuid(999), name: 'Fine name' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('topics.merge', () => {
  it('merges through the atomic SQL function and busts the topic cache', async () => {
    const db = mockDb({}, { board_merge_topics: () => null });
    await expect(admin().topics.merge({ sourceId: T_HOTEL, targetId: T_AWARD })).resolves.toEqual({ ok: true });
    expect(db.rpcLog).toEqual([{ name: 'board_merge_topics', args: { p_source: T_HOTEL, p_target: T_AWARD } }]);
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'topic_merge', target_id: T_HOTEL });
    expect(redis.del).toHaveBeenCalledWith('board:topics');
  });

  it.each([
    ['22023', 'A topic cannot be merged into itself', 'BAD_REQUEST'],
    ['P0002', 'Source topic not found', 'NOT_FOUND'],
    ['XX000', 'boom', 'INTERNAL_SERVER_ERROR'],
  ])('maps database error %s to %s', async (code, message, expected) => {
    const db = mockDb({}, { board_merge_topics: () => ({ error: { code, message } }) });
    await expect(admin().topics.merge({ sourceId: T_HOTEL, targetId: T_AWARD })).rejects.toMatchObject({ code: expected });
    expect(db.of('board_mod_events', 'insert')).toHaveLength(0);
  });
});

describe('topics.hide / promote', () => {
  it('hides, and unhiding returns it as active', async () => {
    const db = mockDb();
    await admin().topics.hide({ id: T_AWARD, hidden: true });
    await admin().topics.hide({ id: T_AWARD, hidden: false });
    expect(db.of('board_topics', 'update').map(payload)).toEqual([{ status: 'hidden' }, { status: 'active' }]);
    expect(db.of('board_mod_events', 'insert').map((q) => payload(q).note)).toEqual(['hidden', 'unhidden']);
  });

  it('a merged topic can\'t be brought back, promoted, or hidden into limbo', async () => {
    const merged = topic(uuid(150), 'Old', 'old', { status: 'hidden', merged_into_id: T_HOTEL });
    const db = mockDb({ board_topics: () => ({ data: [...TOPICS, merged] }) });
    await expect(admin().topics.hide({ id: merged.id as string, hidden: false })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().topics.promote({ id: merged.id as string })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.of('board_topics', 'update')).toHaveLength(0);
  });

  it('promotes a visible topic to common; hidden ones must be shown first; unknown 404s', async () => {
    const hidden = topic(uuid(151), 'Hidden', 'hidden', { status: 'hidden' });
    const active = topic(uuid(152), 'Lounges', 'lounge', { status: 'active' });
    const db = mockDb({ board_topics: () => ({ data: [...TOPICS, hidden, active] }) });
    await admin().topics.promote({ id: active.id as string });
    expect(payload(db.of('board_topics', 'update')[0])).toEqual({ status: 'common' });
    await expect(admin().topics.promote({ id: hidden.id as string })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().topics.promote({ id: uuid(999) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ─── Blocklist + rescan ──────────────────────────────────────────────────────

describe('blockedTerms', () => {
  it('lists, adds a normalised term with the admin recorded, and removes', async () => {
    const db = mockDb({ board_blocked_terms: (q) => (q.action === 'select' ? { data: [{ term: 'zorblax', tier: 'hard', created_at: ago(HOUR) }] } : undefined) });
    expect(await admin().blockedTerms.list()).toEqual([{ term: 'zorblax', tier: 'hard', created_at: expect.any(String) }]);

    await admin().blockedTerms.add({ term: '  Quimbly   Blorp ', tier: 'soft' });
    expect(db.of('board_blocked_terms', 'insert')[0].payload).toEqual({ term: 'quimbly blorp', tier: 'soft', added_by: ADMIN });

    await admin().blockedTerms.remove({ term: 'Quimbly  Blorp' });
    expect(eqValue(db.of('board_blocked_terms', 'delete')[0], 'term')).toBe('quimbly blorp');
    expect(db.of('board_mod_events', 'insert').map((q) => payload(q).action)).toEqual(['term_add', 'term_remove']);
  });

  it('refuses a duplicate and an out-of-range term', async () => {
    mockDb({ board_blocked_terms: (q) => (q.action === 'insert' ? { error: { code: '23505', message: 'dup' } } : undefined) });
    await expect(admin().blockedTerms.add({ term: 'zorblax', tier: 'hard' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(admin().blockedTerms.add({ term: 'x', tier: 'hard' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().blockedTerms.add({ term: 'y'.repeat(65), tier: 'hard' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().blockedTerms.add({ term: 'ok term', tier: 'medium' as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('rescan', () => {
  const terms: Handler = () => ({ data: [{ term: 'zorblax', tier: 'hard' }, { term: 'quimbly', tier: 'soft' }] });

  it('holds recent posts and comments that now match, never removes them, and audits each', async () => {
    const db = mockDb({
      board_blocked_terms: terms,
      board_posts: (q) => (q.action === 'select' ? { data: [
        { id: uuid(1), author_id: ME, title: 'Fine title', body: 'about quimbly stuff', mod_reasons: [] },
        { id: uuid(2), author_id: ME, title: 'Lovely trip', body: 'nothing here', mod_reasons: [] },
        { id: uuid(3), author_id: OTHER, title: 'Hello', body: 'zorblax', mod_reasons: ['reports'] },
      ] } : undefined),
      board_comments: (q) => (q.action === 'select' ? { data: [{ id: uuid(4), author_id: OTHER, body: 'zorblax again', mod_reasons: [] }] } : undefined),
    });
    const out = await admin().rescan({ days: 7 });
    expect(out).toEqual({ scannedPosts: 3, scannedComments: 1, held: 3, truncated: false });

    const posts = db.of('board_posts', 'update');
    expect(posts.map((q) => eqValue(q, 'id'))).toEqual([uuid(1), uuid(3)]);
    expect(payload(posts[0])).toEqual({ mod_status: 'held', mod_reasons: ['soft_blocklist'] });
    expect(payload(posts[1])).toEqual({ mod_status: 'held', mod_reasons: ['reports', 'hard_blocklist'] });
    expect(payload(db.of('board_comments', 'update')[0])).toEqual({ mod_status: 'held', mod_reasons: ['hard_blocklist'] });
    expect(db.of('board_mod_events', 'insert').map(payload)).toEqual(expect.arrayContaining([
      expect.objectContaining({ target_kind: 'post', target_id: uuid(1), action: 'rescan', actor_id: ADMIN, reasons: ['soft_blocklist'] }),
    ]));
    expect(db.of('board_mod_events', 'insert')).toHaveLength(3);
  });

  it('only looks at live, public content inside the window', async () => {
    const db = mockDb({ board_blocked_terms: terms, board_posts: () => ({ data: [] }), board_comments: () => ({ data: [] }) });
    await admin().rescan({ days: 3 });
    const q = db.of('board_posts', 'select')[0];
    expect(called(q, 'is', 'deleted_at', null)).toBe(true);
    expect(called(q, 'in', 'mod_status', ['clean', 'unscanned'])).toBe(true);
    const since = new Date(arg(q, 'gte', 1) as string).getTime();
    expect(Math.abs(Date.now() - since - 3 * 24 * HOUR)).toBeLessThan(5_000);
  });

  it('flags a truncated run, defaults to 30 days and limits the window to 1-30', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: uuid(5000 + i), author_id: ME, title: 't', body: 'clean text', mod_reasons: [] }));
    const db = mockDb({ board_blocked_terms: terms, board_posts: () => ({ data: full }), board_comments: () => ({ data: [] }) });
    expect((await admin().rescan()).truncated).toBe(true);
    const since = new Date(arg(db.of('board_posts', 'select')[0], 'gte', 1) as string).getTime();
    expect(Math.abs(Date.now() - since - 30 * 24 * HOUR)).toBeLessThan(5_000);
    await expect(admin().rescan({ days: 31 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(admin().rescan({ days: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('with no matches holds nothing and does not touch the topic cache', async () => {
    const db = mockDb({ board_blocked_terms: terms, board_posts: (q) => (q.action === 'select' ? { data: [{ id: uuid(1), author_id: ME, title: 'x', body: 'clean', mod_reasons: [] }] } : undefined), board_comments: () => ({ data: [] }) });
    expect((await admin().rescan({ days: 5 })).held).toBe(0);
    expect(db.of('board_posts', 'update')).toHaveLength(0);
    expect(redis.del).not.toHaveBeenCalled();
  });
});

// ─── Dismissing reports ──────────────────────────────────────────────────────

describe('admin.dismissReports', () => {
  const withReports = (n: number, over: Record<string, Handler> = {}) => mockDb({
    board_posts: lookup(target()),
    board_comments: lookup(target({ id: C1 })),
    board_reports: (q) => (q.action === 'select' ? { count: n } : undefined),
    ...over,
  });

  it('settles the open reports, audits it, and leaves the content up', async () => {
    const db = withReports(2);
    await admin().dismissReports({ kind: 'post', id: P1 });

    const settle = db.of('board_reports', 'update')[0];
    expect(payload(settle)).toMatchObject({ resolved_at: expect.any(String), resolved_by: ADMIN });
    expect(called(settle, 'eq', 'target_kind', 'post')).toBe(true);
    expect(called(settle, 'eq', 'target_id', P1)).toBe(true);
    expect(called(settle, 'is', 'resolved_at', null)).toBe(true);
    expect(db.of('board_posts', 'update')).toHaveLength(0);
    expect(payload(db.of('board_mod_events', 'insert')[0])).toMatchObject({ action: 'dismiss_reports', target_id: P1, actor_id: ADMIN, subject_user_id: OTHER });
  });

  it('works on comments', async () => {
    const db = withReports(1);
    await admin().dismissReports({ kind: 'comment', id: C1 });
    expect(called(db.of('board_reports', 'update')[0], 'eq', 'target_kind', 'comment')).toBe(true);
  });

  it('refuses when there is nothing to dismiss, and for missing or deleted content', async () => {
    withReports(0);
    await expect(admin().dismissReports({ kind: 'post', id: P1 })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'There are no open reports to dismiss.' });
    withReports(2, { board_posts: lookup(null) });
    await expect(admin().dismissReports({ kind: 'post', id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    withReports(2, { board_posts: lookup(target({ deleted_at: ago(HOUR) })) });
    await expect(admin().dismissReports({ kind: 'post', id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('is available in bulk, one bad id never blocking the rest', async () => {
    const db = mockDb({
      board_posts: (q) => (q.single ? { data: target({ id: eqValue(q, 'id') }) } : undefined),
      board_reports: (q) => (q.action === 'select' ? { count: eqValue(q, 'target_id') === uuid(9) ? 0 : 1 } : undefined),
    });
    const out = await admin().bulk({ action: 'dismissReports', kind: 'post', ids: [P1, uuid(9)] });
    expect(out.done).toEqual([P1]);
    expect(out.failed).toEqual([{ id: uuid(9), message: 'There are no open reports to dismiss.' }]);
    expect(db.of('board_mod_events', 'insert')).toHaveLength(1);
  });
});

// ─── What a moderator sees on a post and its comments ────────────────────────

describe('report counts on moderator views', () => {
  it('admin.modFeed attaches open reports to held posts too', async () => {
    mockDb({
      board_posts_feed: () => ({ data: [feedRow({ mod_status: 'held', mod_reasons: ['reports'] })] }),
      board_reports: () => ({ data: [{ target_id: P1, reason: 'Spam' }, { target_id: P1, reason: 'Spam' }, { target_id: P1, reason: 'Offensive' }] }),
    });
    const out = await admin().modFeed({ status: 'held' });
    expect(out.posts[0].mod).toMatchObject({ reportCount: 3, reportReasons: ['Spam', 'Offensive'] });
  });

  it('a member never gets report data — no query for it, and no `mod` at all', async () => {
    asUser(ME);
    const db = mockDb({ board_posts_feed: () => ({ data: feedRow() }), board_comments: () => ({ data: [commentRow()] }) });
    const { post, comments } = await caller().board.posts.get({ id: P1 });
    expect(post.mod).toBeNull();
    expect(comments[0].mod).toBeNull();
    expect(db.of('board_reports')).toHaveLength(0);
  });

  it('an admin opening a post sees report counts on the post and on each comment', async () => {
    mockDb({
      board_posts_feed: () => ({ data: feedRow() }),
      board_comments: () => ({ data: [commentRow({ id: C1 })] }),
      board_reports: (q) => (eqValue(q, 'target_kind') === 'comment'
        ? { data: [{ target_id: C1, reason: 'Off-topic' }] }
        : { data: [{ target_id: P1, reason: 'Spam' }] }),
    });
    const { post, comments } = await caller().board.posts.get({ id: P1 });
    expect(post.mod).toMatchObject({ reportCount: 1, reportReasons: ['Spam'] });
    expect(comments[0].mod).toMatchObject({ reportCount: 1, reportReasons: ['Off-topic'] });
  });
});
