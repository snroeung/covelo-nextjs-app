import { vi, beforeEach, describe, it, expect } from 'vitest';
import { makeDb, called, type Handler } from './utils/fakeDb';
import { uuid, OFFER1, T_TRANSFER, TOPICS } from './utils/fixtures';

vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: () => true }));

import { redis } from '@/lib/redis';
import { markDormantTopics } from '@/lib/board/server/dormancy';
import { backfillSystemPosts } from '@/lib/board/server/backfill';
import { purgeExpiredOfferPosts } from '@/lib/board/server/purgeExpired';

const OFFER2 = uuid(61), OFFER3 = uuid(62), OFFER4 = uuid(63);
const NOW = new Date('2026-10-28T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.del).mockResolvedValue(1);
});

describe('markDormantTopics', () => {
  const run = (count: unknown) => {
    const db = makeDb({}, { board_mark_dormant_topics: () => count });
    return { db, result: markDormantTopics(db.client as never) };
  };

  it('returns how many topics went dormant and refreshes the shared chip list', async () => {
    const { db, result } = run(3);
    expect(await result).toBe(3);
    expect(db.rpcLog.map((r) => r.name)).toEqual(['board_mark_dormant_topics']);
    expect(redis.del).toHaveBeenCalledTimes(1);
  });

  it('leaves the cache alone when nothing changed', async () => {
    const { result } = run(0);
    expect(await result).toBe(0);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('surfaces a database error so the scheduled run fails visibly', async () => {
    const { result } = run({ error: { code: 'XX', message: 'boom' } });
    await expect(result).rejects.toBeDefined();
    expect(redis.del).not.toHaveBeenCalled();
  });
});

describe('backfillSystemPosts', () => {
  const offer = (id: string, over: Record<string, unknown> = {}) => ({
    id, post_to_board: true, board_topic: 'Transfer bonuses', board_post_title: `Post ${id.slice(-2)}`, board_post_body: 'Body', ...over,
  });

  function setup(offers: Record<string, unknown>[], posts: Array<{ offer_id: string; deleted_at: string | null }> = [], over: Record<string, Handler> = {}) {
    return makeDb({
      transfer_bonuses: () => ({ data: offers }),
      spending_bonuses: () => ({ data: [] }),
      board_posts: (q) => {
        if (q.action === 'insert') return { data: { id: uuid(900) } };
        // syncSystemPost looks one offer up with .eq('offer_id'); the backfill lists many with .in('offer_id')
        const one = q.calls.find((c) => c[0] === 'eq' && c[1][0] === 'offer_id')?.[1][1];
        return { data: one ? posts.filter((p) => p.offer_id === one) : posts };
      },
      board_topics: () => ({ data: TOPICS }),
      board_post_topics: () => ({ data: [] }),
      ...over,
    });
  }

  it('asks only for live, approved, switched-on offers', async () => {
    const db = setup([]);
    await backfillSystemPosts(db.client as never, { dry: true, now: NOW });
    const q = db.of('transfer_bonuses')[0];
    expect(called(q, 'eq', 'post_to_board', true)).toBe(true);
    expect(called(q, 'eq', 'active', true)).toBe(true);
    expect(called(q, 'in', 'status', ['admin', 'approved'])).toBe(true);
    expect(called(q, 'or', 'end_date.is.null,end_date.gte.2026-10-28')).toBe(true);
  });

  it('posts an offer that has none, as covelo with no admin attached', async () => {
    const db = setup([offer(OFFER1)]);
    const out = await backfillSystemPosts(db.client as never, { dry: false, now: NOW });
    expect(out.posted).toEqual([{ table: 'transfer_bonuses', id: OFFER1, title: `Post ${OFFER1.slice(-2)}` }]);
    const insert = db.of('board_posts', 'insert')[0].payload as Record<string, unknown>;
    expect(insert).toMatchObject({ is_system: true, author_id: null, offer_table: 'transfer_bonuses', offer_id: OFFER1, verified_by: null, topic_id: T_TRANSFER });
  });

  it('a dry run lists what it would post and writes nothing', async () => {
    const db = setup([offer(OFFER1), offer(OFFER2)]);
    const out = await backfillSystemPosts(db.client as never, { dry: true, now: NOW });
    expect(out.posted).toHaveLength(2);
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
    expect(db.of('board_posts', 'update')).toHaveLength(0);
  });

  it('skips an offer that already has a visible post, so running twice makes no duplicates', async () => {
    const db = setup([offer(OFFER1), offer(OFFER2)], [{ offer_id: OFFER1, deleted_at: null }]);
    const out = await backfillSystemPosts(db.client as never, { dry: false, now: NOW });
    expect(out.skipped).toEqual([{ table: 'transfer_bonuses', id: OFFER1, reason: 'already posted' }]);
    expect(out.posted.map((p) => p.id)).toEqual([OFFER2]);
    expect(db.of('board_posts', 'insert')).toHaveLength(1);
  });

  it('revives an offer whose post was hidden but is switched on again', async () => {
    const db = setup([offer(OFFER1)], [{ offer_id: OFFER1, deleted_at: '2026-10-01T00:00:00Z' }], {
      board_posts: (q) => (q.action === 'select' ? { data: [{ id: uuid(901), offer_id: OFFER1, deleted_at: '2026-10-01T00:00:00Z' }] } : undefined),
    });
    const out = await backfillSystemPosts(db.client as never, { dry: false, now: NOW });
    expect(out.posted).toHaveLength(1);
    expect(db.of('board_posts', 'update')[0].payload).toMatchObject({ deleted_at: null });
  });

  it.each([
    ['no title', { board_post_title: '  ' }],
    ['no topic', { board_topic: null }],
  ])('skips an offer with %s', async (_n, over) => {
    const db = setup([offer(OFFER3, over)]);
    const out = await backfillSystemPosts(db.client as never, { dry: false, now: NOW });
    expect(out.skipped).toEqual([{ table: 'transfer_bonuses', id: OFFER3, reason: 'missing title or topic' }]);
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
  });

  it('reports an unknown topic as a failure and carries on with the rest', async () => {
    const db = setup([offer(OFFER3, { board_topic: 'No such topic' }), offer(OFFER4)]);
    const out = await backfillSystemPosts(db.client as never, { dry: false, now: NOW });
    expect(out.failed).toEqual([{ table: 'transfer_bonuses', id: OFFER3, error: expect.stringMatching(/Unknown board topic/) }]);
    expect(out.posted.map((p) => p.id)).toEqual([OFFER4]);
  });

  it('does nothing, and asks nothing about posts, when no offer is switched on', async () => {
    const db = setup([]);
    const out = await backfillSystemPosts(db.client as never, { dry: false, now: NOW });
    expect(out).toEqual({ posted: [], skipped: [], failed: [] });
    expect(db.of('board_posts')).toHaveLength(0);
  });
});

describe('purgeExpiredOfferPosts', () => {
  const NOW_ = new Date('2026-10-28T12:00:00Z');
  const due = (id: string, expired: string) => ({ id, title: `Post ${id.slice(-2)}`, offer_expires_on: expired });
  const make = (rows: unknown[]) => makeDb({ board_posts_feed: () => ({ data: rows }), board_posts: () => ({ data: null }) });

  it('asks for live offer posts whose offer ended before the grace period (7 days by default)', async () => {
    const db = make([]);
    await purgeExpiredOfferPosts(db.client as never, { dry: false, now: NOW_ });
    const q = db.of('board_posts_feed')[0];
    expect(called(q, 'eq', 'kind', 'offer')).toBe(true);
    expect(called(q, 'is', 'deleted_at', null)).toBe(true);
    expect(called(q, 'lt', 'offer_expires_on', '2026-10-21')).toBe(true); // ended before Oct 21 = over 7 days ago
    expect(called(q, 'order', 'offer_expires_on', { ascending: true })).toBe(true);
  });

  it('removes them by soft delete — the author-delete mechanism — and refreshes the chip list', async () => {
    const db = make([due(OFFER1, '2026-10-01'), due(OFFER2, '2026-10-10')]);
    const out = await purgeExpiredOfferPosts(db.client as never, { dry: false, now: NOW_ });
    expect(out.posts.map((p) => p.id)).toEqual([OFFER1, OFFER2]);
    const update = db.of('board_posts', 'update')[0];
    expect(update.payload).toEqual({ deleted_at: NOW_.toISOString() });
    expect(called(update, 'in', 'id', [OFFER1, OFFER2])).toBe(true);
    expect(called(update, 'is', 'deleted_at', null)).toBe(true); // never re-stamps one already removed
    expect(db.of('board_posts', 'delete')).toHaveLength(0); // never a hard delete
    expect(redis.del).toHaveBeenCalledTimes(1);
  });

  it('a dry run lists them and writes nothing', async () => {
    const db = make([due(OFFER1, '2026-10-01')]);
    const out = await purgeExpiredOfferPosts(db.client as never, { dry: true, now: NOW_ });
    expect(out.posts).toEqual([{ id: OFFER1, title: `Post ${OFFER1.slice(-2)}`, offerExpiredOn: '2026-10-01' }]);
    expect(db.of('board_posts')).toHaveLength(0);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('does nothing when nothing is due', async () => {
    const db = make([]);
    const out = await purgeExpiredOfferPosts(db.client as never, { dry: false, now: NOW_ });
    expect(out).toEqual({ posts: [], truncated: false });
    expect(db.of('board_posts')).toHaveLength(0);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('honours a custom grace period, including none', async () => {
    const db = make([]);
    await purgeExpiredOfferPosts(db.client as never, { dry: true, graceDays: 30, now: NOW_ });
    await purgeExpiredOfferPosts(db.client as never, { dry: true, graceDays: 0, now: NOW_ });
    expect(called(db.of('board_posts_feed')[0], 'lt', 'offer_expires_on', '2026-09-28')).toBe(true);
    expect(called(db.of('board_posts_feed')[1], 'lt', 'offer_expires_on', '2026-10-28')).toBe(true);
  });

  it('says so when more were due than one run takes', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => due(uuid(1000 + i), '2026-09-01'));
    const out = await purgeExpiredOfferPosts(make(rows).client as never, { dry: true, now: NOW_ });
    expect(out.truncated).toBe(true);
  });

  it('fails the run when the database errors, rather than reporting success', async () => {
    const db = makeDb({ board_posts_feed: () => ({ error: { message: 'down' } }) });
    await expect(purgeExpiredOfferPosts(db.client as never, { dry: false, now: NOW_ })).rejects.toBeDefined();
  });
});
