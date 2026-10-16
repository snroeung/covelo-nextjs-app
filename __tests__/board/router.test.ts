import { vi, beforeEach, describe, it, expect } from 'vitest';
import { makeDb, arg, called, eqValue, type Handler } from './utils/fakeDb';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
const flagState = vi.hoisted(() => ({ enabled: true, off: new Set<string>() }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: (flag: string) => flagState.enabled && !flagState.off.has(flag) }));
const classify = vi.hoisted(() => vi.fn());
vi.mock('@/lib/board/moderation/classify', () => ({ classifyContent: classify }));

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { redis } from '@/lib/redis';
import { appRouter } from '@/server/routers/_app';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ME = uuid(1), OTHER = uuid(2), ADMIN = uuid(3);
const T_TRANSFER = uuid(100), T_HOTEL = uuid(101), T_AWARD = uuid(102), T_CREDIT = uuid(103), T_NEW = uuid(104);
const P1 = uuid(200), C1 = uuid(300), C2 = uuid(301), OFFER1 = uuid(400), MO1 = uuid(500);

const topic = (id: string, name: string, key: string, over: Record<string, unknown> = {}) =>
  ({ id, name, key, status: 'common', merged_into_id: null, ...over });
const TOPICS = [
  topic(T_TRANSFER, 'Transfer bonuses', 'transfer bonus'),
  topic(T_HOTEL, 'Hotels', 'hotel'),
  topic(T_AWARD, 'Award flights', 'award flight'),
  topic(T_CREDIT, 'Statement credits', 'statement credit'),
];

const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000, HOUR = 3_600_000;

function feedRow(over: Record<string, unknown> = {}) {
  return {
    id: P1, kind: 'tip', author_id: OTHER, is_system: false, topic_id: T_HOTEL, title: 'Hyatt tip', body: 'body',
    offer_table: null, offer_id: null, member_offer_id: null, review: null, verified_by: null, verified_at: null,
    reject_reason: null, score: 3, comment_count: 0, comments_locked: false, created_at: ago(2 * HOUR), deleted_at: null,
    mod_status: 'clean', mod_reasons: [], mod_flags: [], mod_scores: null, removed_reason: null, author_name: 'pointsplease',
    topic_ids: [T_HOTEL], ...over,
  };
}

function commentRow(over: Record<string, unknown> = {}) {
  return {
    id: C1, post_id: P1, parent_id: null, author_id: OTHER, body: 'nice', score: 1, created_at: ago(HOUR), deleted_at: null,
    mod_status: 'clean', mod_reasons: [], mod_flags: [], mod_scores: null, removed_reason: null, ...over,
  };
}

const CLEAN = {
  ok: true, model: 'claude-haiku-4-5',
  verdict: { toxicity: 0.01, spam: 0.01, on_topic: 0.95, categories: [], suggested_topic: null, topic_confidence: 0, rejected_topics: [], reason: 'fine' },
};

function asUser(id: string | null, extra: { admin?: boolean; createdDaysAgo?: number } = {}) {
  const user = id ? {
    id, created_at: new Date(NOW - (extra.createdDaysAgo ?? 400) * 24 * HOUR).toISOString(),
    app_metadata: extra.admin ? { role: 'admin' } : {}, user_metadata: {},
  } : null;
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no session' } }) },
  } as never);
}

/** The usual member database; a test overrides only the tables it cares about. */
function mockDb(over: Record<string, Handler> = {}, rpcs: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  const base: Record<string, Handler> = {
    profiles: (q) => (q.single ? { data: { display_name: 'milesnerd' } } : { data: [] }),
    board_topics: (q) => (eqValue(q, 'created_by') ? { data: [] } : { data: TOPICS }),
    board_posts: (q) => (q.action === 'insert' ? { data: { id: P1 } } : q.head ? { count: 4 } : { data: [] }),
    board_posts_feed: (q) => (q.head ? { count: 1 } : { data: feedRow({ author_id: ME }) }),
  };
  const db = makeDb({ ...base, ...over }, { board_max_title_similarity: () => 0, board_similar_topics: () => [], ...rpcs });
  vi.mocked(getSupabaseAdmin).mockReturnValue(db.client as never);
  return db;
}

const caller = () => appRouter.createCaller({});
const tipInput = { kind: 'tip' as const, title: 'Search awards one seat at a time', body: 'works', topics: [{ id: T_HOTEL }] };

beforeEach(() => {
  vi.clearAllMocks();
  flagState.enabled = true;
  flagState.off.clear();
  classify.mockResolvedValue(CLEAN);
  vi.mocked(redis.get).mockResolvedValue(null);
  vi.mocked(redis.set).mockResolvedValue('OK');
  vi.mocked(redis.del).mockResolvedValue(1);
  asUser(ME);
});

// ─── posts.create ────────────────────────────────────────────────────────────

describe('posts.create — happy path', () => {
  it('posts a tip: no review, clean, primary topic first, search text, audit event, cache bust', async () => {
    const db = mockDb();
    const out = await caller().board.posts.create({ ...tipInput, topics: [{ id: T_HOTEL }, { id: T_AWARD }] });

    expect(out.moderation).toEqual({ status: 'clean', reasons: [], message: null });
    expect(out.post.id).toBe(P1);

    const post = db.of('board_posts', 'insert')[0].payload as Record<string, unknown>;
    expect(post).toMatchObject({
      kind: 'tip', author_id: ME, topic_id: T_HOTEL, review: null, mod_status: 'clean', offer_id: null, member_offer_id: null,
    });
    expect(post.search_extra).toContain('milesnerd');
    expect(post.search_extra).toContain('Award flights');

    expect(db.of('board_post_topics', 'insert')[0].payload).toEqual([
      { post_id: P1, topic_id: T_HOTEL, is_primary: true, created_new: false },
      { post_id: P1, topic_id: T_AWARD, is_primary: false, created_new: false },
    ]);
    expect(db.of('board_mod_events', 'insert')[0].payload).toMatchObject({ target_kind: 'post', target_id: P1, action: 'auto_allow', subject_user_id: ME });
    expect(redis.del).toHaveBeenCalledWith('board:topics');
    expect(db.of('board_topics', 'upsert')).toHaveLength(0);
  });

  it('marks the post unscanned when the classifier is unavailable', async () => {
    classify.mockResolvedValue({ ok: false, reason: 'timeout' });
    const db = mockDb();
    const out = await caller().board.posts.create(tipInput);
    expect(out.moderation.status).toBe('unscanned');
    expect((db.of('board_posts', 'insert')[0].payload as Record<string, unknown>).mod_status).toBe('unscanned');
  });

  it('creates new topics only after moderation passes, with the first pick as primary', async () => {
    const db = mockDb({
      board_topics: (q) => q.action === 'upsert'
        ? { data: [topic(T_NEW, 'Airport lounges', 'airport lounge', { status: 'provisional' })] }
        : eqValue(q, 'created_by') ? { data: [] } : { data: TOPICS },
    });
    await caller().board.posts.create({ ...tipInput, topics: [{ name: 'airport lounges' }, { id: T_HOTEL }] });

    expect(db.of('board_topics', 'upsert')[0].payload).toEqual({ name: 'Airport lounges', key: 'airport lounge', status: 'provisional', created_by: ME });
    expect((db.of('board_posts', 'insert')[0].payload as Record<string, unknown>).topic_id).toBe(T_NEW);
    expect(db.of('board_post_topics', 'insert')[0].payload).toEqual([
      { post_id: P1, topic_id: T_NEW, is_primary: true, created_new: true },
      { post_id: P1, topic_id: T_HOTEL, is_primary: false, created_new: false },
    ]);
  });

  it('maps a typed name onto an existing topic instead of creating one', async () => {
    const db = mockDb();
    await caller().board.posts.create({ ...tipInput, topics: [{ name: 'hotel' }, { name: 'HOTELS' }] });
    expect(db.of('board_topics', 'upsert')).toHaveLength(0);
    expect((db.of('board_post_topics', 'insert')[0].payload as unknown[]).length).toBe(1);
  });

  it('treats a close pg_trgm match as the existing topic', async () => {
    const db = mockDb({}, { board_similar_topics: () => [{ id: T_AWARD, name: 'Award flights', key: 'award flight', status: 'common', similarity: 0.9 }] });
    await caller().board.posts.create({ ...tipInput, topics: [{ name: 'Award flightz' }] });
    expect(db.of('board_topics', 'upsert')).toHaveLength(0);
    expect((db.of('board_posts', 'insert')[0].payload as Record<string, unknown>).topic_id).toBe(T_AWARD);
  });
});

describe('posts.create — moderation', () => {
  const adminTerms: Handler = () => ({ data: [{ term: 'zorblax', tier: 'hard' }, { term: 'quimbly', tier: 'soft' }] });

  it('rejects a hard blocklist hit: nothing stored, audited by hash only, no classifier call, no topics made', async () => {
    const db = mockDb({ board_blocked_terms: adminTerms });
    await expect(caller().board.posts.create({ ...tipInput, title: 'zorblax post', topics: [{ name: 'Brand new topic' }] }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'This breaks the board rules (offensive language).' });

    expect(db.of('board_posts', 'insert')).toHaveLength(0);
    expect(db.of('board_topics', 'upsert')).toHaveLength(0);
    expect(classify).not.toHaveBeenCalled();
    const event = db.of('board_mod_events', 'insert')[0].payload as Record<string, unknown>;
    expect(event).toMatchObject({ action: 'auto_reject', target_id: null, subject_user_id: ME, reasons: ['hard_blocklist'] });
    expect(event.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(event)).not.toContain('zorblax');
  });

  it('rejects referral links and a referral source link on a new offer', async () => {
    const db = mockDb();
    await expect(caller().board.posts.create({ ...tipInput, body: 'use my code https://bit.ly/abc' }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Remove referral or affiliate links.' });
    await expect(caller().board.posts.create({
      kind: 'offer', title: 'Deal', topics: [{ id: T_HOTEL }],
      newOffer: { type: 'PARTNER DEAL', value: '5×', name: 'Five times', from: 'Bilt', url: 'https://example.com/?ref=abc' },
    })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Remove referral or affiliate links.' });
    expect(db.of('board_member_offers', 'insert')).toHaveLength(0);
  });

  it('rejects a blocked topic name and still counts it as a rejected submission', async () => {
    const db = mockDb({ board_blocked_terms: adminTerms });
    await expect(caller().board.posts.create({ ...tipInput, topics: [{ name: 'zorblax deals' }] }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'That topic name breaks the board rules.' });
    expect(db.of('board_mod_events', 'insert')[0].payload).toMatchObject({ action: 'auto_reject', subject_user_id: ME });
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
  });

  it('holds a soft blocklist hit — stored, author-only', async () => {
    const db = mockDb({
      board_blocked_terms: adminTerms,
      board_posts_feed: () => ({ data: feedRow({ author_id: ME, mod_status: 'held', mod_reasons: ['soft_blocklist'] }) }),
    });
    const out = await caller().board.posts.create({ ...tipInput, title: 'so quimbly today' });
    expect(out.moderation.status).toBe('held');
    expect(out.moderation.reasons).toEqual(['soft_blocklist']);
    expect(out.moderation.message).toMatch(/Held for review/);
    expect(out.post.notice).toMatchObject({ kind: 'held' });
    expect(db.of('board_posts', 'insert')[0].payload).toMatchObject({ mod_status: 'held', mod_reasons: ['soft_blocklist'] });
    expect(db.of('board_mod_events', 'insert')[0].payload).toMatchObject({ action: 'auto_hold' });
  });

  it('holds off-topic content with the off-topic message', async () => {
    classify.mockResolvedValue({ ...CLEAN, verdict: { ...CLEAN.verdict, on_topic: 0.1 } });
    mockDb();
    const out = await caller().board.posts.create({ ...tipInput, title: 'Who wins the election this fall', body: '' });
    expect(out.moderation).toMatchObject({ status: 'held', reasons: ['off_topic'] });
    expect(out.moderation.message).toMatch(/travel or points/);
  });

  it('holds a near-duplicate of the author\'s own recent title', async () => {
    mockDb({}, { board_max_title_similarity: () => 0.95 });
    const out = await caller().board.posts.create(tipInput);
    expect(out.moderation).toMatchObject({ status: 'held', reasons: ['duplicate'] });
  });

  it('holds everything from a restricted author, and rejects a banned one', async () => {
    mockDb({ board_author_standing: () => ({ data: { standing: 'restricted' } }) });
    expect((await caller().board.posts.create(tipInput)).moderation.reasons).toEqual(['restricted_author']);
    mockDb({ board_author_standing: () => ({ data: { standing: 'banned' } }) });
    await expect(caller().board.posts.create(tipInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('posts.create — limits', () => {
  const post = (msAgo: number) => ({ created_at: ago(msAgo), kind: 'tip', member_offer_id: null, offer_table: null, offer_id: null });

  it('blocks at the daily post cap with a wait time and retryAt', async () => {
    mockDb({ board_posts: (q) => (q.head ? { count: 9 } : q.action === 'select' ? { data: Array.from({ length: 10 }, (_, i) => post(3 * HOUR + i * 2 * HOUR)) } : undefined) });
    const err = await caller().board.posts.create(tipInput).catch((e) => e);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
    expect(err.message).toMatch(/limit is 10 posts per day/);
    expect(typeof err.cause.retryAt).toBe('string');
  });

  it('enforces the 30 s gap between posts', async () => {
    mockDb({ board_posts: (q) => (q.head ? { count: 1 } : q.action === 'select' ? { data: [post(10_000)] } : undefined) });
    await expect(caller().board.posts.create(tipInput)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/Slow down/) });
  });

  it('locks writes after repeated rejected submissions', async () => {
    mockDb({ board_mod_events: (q) => (eqValue(q, 'action') === 'auto_reject' ? { data: Array.from({ length: 5 }, (_, i) => ({ created_at: ago(i * MIN + MIN) })) } : { data: [] }) });
    await expect(caller().board.posts.create(tipInput)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/broke the board rules/) });
  });

  it('allows an admin past every cap', async () => {
    asUser(ADMIN, { admin: true });
    mockDb({ board_posts: (q) => (q.action === 'insert' ? { data: { id: P1 } } : q.head ? { count: 1 } : { data: Array.from({ length: 50 }, (_, i) => post(i * MIN + MIN)) }) });
    await expect(caller().board.posts.create(tipInput)).resolves.toBeTruthy();
  });

  it('caps new topics at 3 per post and topics at 5 per post', async () => {
    const db = mockDb();
    await expect(caller().board.posts.create({ ...tipInput, topics: ['Alpha one', 'Beta two', 'Gamma three', 'Delta four'].map((name) => ({ name })) }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Max 3 new topics per post.' });
    // The schema stops a sixth pick before the server ever resolves topics
    await expect(caller().board.posts.create({ ...tipInput, topics: [T_TRANSFER, T_HOTEL, T_AWARD, T_CREDIT, T_NEW, uuid(105)].map((id) => ({ id })) }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.of('board_topics', 'upsert')).toHaveLength(0);
  });

  it('caps new topics per day across posts', async () => {
    mockDb({ board_topics: (q) => (eqValue(q, 'created_by') ? { data: Array.from({ length: 5 }, (_, i) => ({ created_at: ago(i * HOUR + HOUR) })) } : { data: TOPICS }) });
    await expect(caller().board.posts.create({ ...tipInput, topics: [{ name: 'Alpha one' }, { name: 'Beta two' }] }))
      .rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/new topics per day/) });
  });

  it('requires a signed-in member', async () => {
    asUser(null);
    mockDb();
    await expect(caller().board.posts.create(tipInput)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('is gone when api:board is off', async () => {
    flagState.enabled = false;
    await expect(caller().board.posts.create(tipInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('posts.create — offers', () => {
  const liveOffer = { id: OFFER1, status: 'approved', active: true, end_date: new Date(NOW + 5 * 24 * HOUR).toISOString().slice(0, 10) };
  const offerInput = { kind: 'offer' as const, title: 'Bilt → Hyatt 30%', topics: [{ id: T_TRANSFER }], link: { table: 'transfer_bonuses' as const, id: OFFER1 } };

  it('links a live catalog offer as a pending, unverified post', async () => {
    const db = mockDb({
      transfer_bonuses: (q) => (q.single ? { data: liveOffer } : { data: [] }),
      board_posts: (q) => (q.action === 'insert' ? { data: { id: P1 } } : q.head ? { count: eqValue(q, 'offer_table') ? 0 : 4 } : { data: [] }),
    });
    await caller().board.posts.create(offerInput);
    expect(db.of('board_posts', 'insert')[0].payload).toMatchObject({
      kind: 'offer', review: 'pending', offer_table: 'transfer_bonuses', offer_id: OFFER1, member_offer_id: null,
    });
  });

  it.each([
    ['pending', { status: 'pending' }], ['inactive', { active: false }], ['expired', { end_date: '2020-01-01' }],
  ])('refuses to link a %s offer', async (_name, patch) => {
    mockDb({ transfer_bonuses: (q) => (q.single ? { data: { ...liveOffer, ...patch } } : { data: [] }) });
    await expect(caller().board.posts.create(offerInput)).rejects.toMatchObject({ code: 'BAD_REQUEST', message: "That offer isn't available to link." });
  });

  it('refuses a missing offer', async () => {
    mockDb({ transfer_bonuses: () => ({ data: null }) });
    await expect(caller().board.posts.create(offerInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('refuses to re-post the same offer within 7 days', async () => {
    mockDb({
      transfer_bonuses: (q) => (q.single ? { data: liveOffer } : { data: [] }),
      board_posts: (q) => (q.head ? { count: eqValue(q, 'offer_table') ? 1 : 4 } : { data: [] }),
    });
    await expect(caller().board.posts.create(offerInput)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('creates a member offer, then a post that points at it', async () => {
    const db = mockDb({ board_member_offers: (q) => (q.action === 'insert' ? { data: { id: MO1 } } : undefined) });
    await caller().board.posts.create({
      kind: 'offer', title: 'Amex → Virgin 25%', topics: [{ id: T_TRANSFER }],
      newOffer: { type: 'TRANSFER BONUS', value: '+25%', name: '25% transfer bonus · Amex → Virgin', from: 'Amex', to: 'Virgin Atlantic', conditions: 'Max 50k', ends: 'Jun 30', url: 'https://www.virginatlantic.com/promo' },
    });
    expect(db.of('board_member_offers', 'insert')[0].payload).toEqual({
      type: 'TRANSFER BONUS', value: '+25%', name: '25% transfer bonus · Amex → Virgin', from_program: 'Amex', to_program: 'Virgin Atlantic',
      conditions: 'Max 50k', ends_label: 'Jun 30', source_url: 'https://www.virginatlantic.com/promo',
    });
    expect(db.of('board_posts', 'insert')[0].payload).toMatchObject({ review: 'pending', member_offer_id: MO1, offer_id: null, offer_table: null });
  });

  it('rate limits member-created offers more tightly', async () => {
    mockDb({ board_posts: (q) => (q.head ? { count: 4 } : q.action === 'select' ? { data: [{ created_at: ago(2 * HOUR), kind: 'offer', member_offer_id: MO1, offer_table: null, offer_id: null }, { created_at: ago(3 * HOUR), kind: 'offer', member_offer_id: MO1, offer_table: null, offer_id: null }, { created_at: ago(4 * HOUR), kind: 'offer', member_offer_id: MO1, offer_table: null, offer_id: null }] } : undefined) });
    await expect(caller().board.posts.create({
      kind: 'offer', title: 'Another', topics: [{ id: T_TRANSFER }], newOffer: { type: 'FREE NIGHT', value: 'Free', name: 'Free night', from: 'Hyatt' },
    })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/new offers per day/) });
  });

  it('undoes the member offer, the post and any new topics if a later insert fails', async () => {
    const db = mockDb({
      board_member_offers: (q) => (q.action === 'insert' ? { data: { id: MO1 } } : undefined),
      board_topics: (q) => q.action === 'upsert'
        ? { data: [topic(T_NEW, 'Airport lounges', 'airport lounge', { status: 'provisional' })] }
        : eqValue(q, 'created_by') ? { data: [] } : { data: TOPICS },
      board_post_topics: () => ({ error: { message: 'link failed' } }),
    });
    await expect(caller().board.posts.create({
      kind: 'offer', title: 'Deal', topics: [{ name: 'Airport lounges' }], newOffer: { type: 'FREE NIGHT', value: 'Free', name: 'Free night', from: 'Hyatt' },
    })).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(db.of('board_posts', 'delete')).toHaveLength(1);
    expect(db.of('board_member_offers', 'delete')).toHaveLength(1);
    expect(db.of('board_topics', 'delete')).toHaveLength(1);
  });

  it('keeps the saved post when only the final read fails', async () => {
    const db = mockDb({ board_posts_feed: () => ({ error: { message: 'replica lag' } }) });
    await expect(caller().board.posts.create(tipInput)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(db.of('board_posts', 'insert')).toHaveLength(1);
    expect(db.of('board_posts', 'delete')).toHaveLength(0);
    expect(db.of('board_post_topics', 'delete')).toHaveLength(0);
  });

  it('validates the offer payload shape', async () => {
    mockDb();
    await expect(caller().board.posts.create({ ...tipInput, link: offerInput.link })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller().board.posts.create({ kind: 'offer', title: 'x', topics: [{ id: T_HOTEL }] })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller().board.posts.create({
      kind: 'offer', title: 'x', topics: [{ id: T_HOTEL }], link: offerInput.link, newOffer: { type: 'FREE NIGHT', value: 'Free', name: 'n', from: 'f' },
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller().board.posts.create({
      kind: 'offer', title: 'x', topics: [{ id: T_HOTEL }], newOffer: { type: 'FREE NIGHT', value: 'Free', name: 'n', from: 'f', url: 'javascript:alert(1)' },
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ─── posts.list / posts.get ─────────────────────────────────────────────────

describe('posts.list', () => {
  const feedQueries = (db: ReturnType<typeof mockDb>) => db.of('board_posts_feed').filter((q) => !q.head);

  it('shows signed-out viewers public posts only, with chip counts on page one', async () => {
    asUser(null);
    const db = mockDb(
      { board_posts_feed: (q) => (q.head ? { count: 7 } : { data: [feedRow()] }) },
      { board_topic_counts: () => [{ topic_id: T_HOTEL, n: '3' }] },
    );
    const out = await caller().board.posts.list({});
    expect(out.posts.map((p) => p.id)).toEqual([P1]);
    expect(out.counts).toEqual({ all: 7, byTopic: { [T_HOTEL]: 3 } });

    const q = feedQueries(db)[0];
    expect(called(q, 'is', 'deleted_at', null)).toBe(true);
    expect(called(q, 'in', 'mod_status', ['clean', 'unscanned'])).toBe(true);
    expect(called(q, 'or', 'review.is.null,review.neq.rejected')).toBe(true);
  });

  it('adds the viewer\'s own held and rejected posts for a signed-in member', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: [feedRow()] }) });
    await caller().board.posts.list({});
    const or = arg(feedQueries(db)[0], 'or') as string;
    expect(or).toBe(`and(mod_status.in.(clean,unscanned),or(review.is.null,review.neq.rejected)),author_id.eq.${ME}`);
  });

  it('hot pulls both a newest and a top window; new and top pull one', async () => {
    const run = async (sort: 'hot' | 'new' | 'top') => {
      const db = mockDb({ board_posts_feed: () => ({ data: [feedRow()] }) });
      await caller().board.posts.list({ sort });
      return feedQueries(db).length;
    };
    expect(await run('hot')).toBe(2);
    expect(await run('new')).toBe(1);
    expect(await run('top')).toBe(1);
  });

  it('applies type, verified, search and topic-family filters', async () => {
    const child = topic(uuid(105), 'Lodging', 'lodging', { status: 'hidden', merged_into_id: T_HOTEL });
    const db = mockDb({
      board_topics: () => ({ data: [...TOPICS, child] }),
      board_posts_feed: () => ({ data: [] }),
    });
    await caller().board.posts.list({ type: 'offer', verified: true, q: 'hyatt', topic: T_HOTEL });
    const q = feedQueries(db)[0];
    expect(called(q, 'eq', 'kind', 'offer')).toBe(true);
    expect(called(q, 'eq', 'review', 'approved')).toBe(true);
    expect(arg(q, 'textSearch', 1)).toBe('hyatt');
    expect(arg(q, 'overlaps', 1)).toEqual(expect.arrayContaining([T_HOTEL, uuid(105)]));
  });

  it('ignores "verified only" while browsing tips', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: [] }) });
    await caller().board.posts.list({ type: 'tip', verified: true });
    expect(called(feedQueries(db)[0], 'eq', 'review', 'approved')).toBe(false);
  });

  it('pages without recomputing counts, and returns a cursor when more remain', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => feedRow({ id: uuid(600 + i), score: i, created_at: ago(i * MIN + MIN) }));
    const db = mockDb({ board_posts_feed: () => ({ data: rows }) });
    const first = await caller().board.posts.list({ sort: 'new' });
    expect(first.posts).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    expect(first.counts).not.toBeNull();

    const second = await caller().board.posts.list({ sort: 'new', cursor: first.nextCursor });
    expect(second.posts).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(second.counts).toBeNull();
    expect(new Set([...first.posts, ...second.posts].map((p) => p.id)).size).toBe(25);
    expect(db.rpcLog.filter((r) => r.name === 'board_topic_counts')).toHaveLength(1);
  });

  it('hydrates the viewer\'s vote, save, topics and offer', async () => {
    const row = feedRow({ kind: 'offer', review: 'approved', verified_by: ADMIN, verified_at: ago(HOUR), offer_table: 'transfer_bonuses', offer_id: OFFER1, topic_ids: [T_AWARD, T_HOTEL], topic_id: T_HOTEL });
    mockDb({
      board_posts_feed: () => ({ data: [row] }),
      board_votes: () => ({ data: [{ post_id: P1, value: -1 }] }),
      board_saves: () => ({ data: [{ post_id: P1 }] }),
      transfer_bonuses: () => ({ data: [{ id: OFFER1, issuer: 'bilt', transfer_partner: 'World of Hyatt', bonus_pct: 30, end_date: '2099-01-01', description: null, source_url: null }] }),
      profiles: () => ({ data: [{ id: ADMIN, display_name: 'Nina Rivera' }] }),
    });
    const [post] = (await caller().board.posts.list({})).posts;
    expect(post).toMatchObject({ myVote: -1, saved: true, review: 'approved', verified: { by: 'NR' }, isMine: false });
    expect(post.topics.map((t) => t.id)).toEqual([T_HOTEL, T_AWARD]);
    expect(post.offer).toMatchObject({ source: 'catalog', value: '+30%', from: 'Bilt', to: 'World of Hyatt' });
    expect(post.mod).toBeNull();
  });

  it('is gone when api:board is off', async () => {
    flagState.enabled = false;
    await expect(caller().board.posts.list({})).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('posts.get', () => {
  it('404s a held post for anyone but its author or an admin', async () => {
    const held = feedRow({ mod_status: 'held', author_id: OTHER });
    mockDb({ board_posts_feed: () => ({ data: held }) });
    await expect(caller().board.posts.get({ id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    asUser(OTHER);
    mockDb({ board_posts_feed: () => ({ data: held }) });
    expect((await caller().board.posts.get({ id: P1 })).post.notice).toMatchObject({ kind: 'held' });

    asUser(ADMIN, { admin: true });
    mockDb({ board_posts_feed: () => ({ data: held }) });
    expect((await caller().board.posts.get({ id: P1 })).post.mod).toMatchObject({ status: 'held' });
  });

  it('404s a missing or deleted post, and hides rejected offers from others', async () => {
    mockDb({ board_posts_feed: () => ({ data: null }) });
    await expect(caller().board.posts.get({ id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    mockDb({ board_posts_feed: () => ({ data: feedRow({ deleted_at: ago(HOUR) }) }) });
    await expect(caller().board.posts.get({ id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    mockDb({ board_posts_feed: () => ({ data: feedRow({ kind: 'offer', review: 'rejected', reject_reason: 'Offer expired' }) }) });
    await expect(caller().board.posts.get({ id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the thread with held comments hidden and removed ones as placeholders', async () => {
    mockDb({
      board_posts_feed: () => ({ data: feedRow() }),
      board_comments: () => ({ data: [
        commentRow({ id: C1 }),
        commentRow({ id: C2, parent_id: C1, mod_status: 'held', author_id: OTHER }),
        commentRow({ id: uuid(302), parent_id: C1, mod_status: 'removed', body: 'rude', removed_reason: 'Offensive' }),
      ] }),
      profiles: () => ({ data: [{ id: OTHER, display_name: 'pointsplease' }] }),
    });
    const { comments } = await caller().board.posts.get({ id: P1 });
    expect(comments).toHaveLength(1);
    expect(comments[0].replies.map((c) => c.body)).toEqual(['[removed by moderator]']);
  });
});

// ─── posts.edit / delete ─────────────────────────────────────────────────────

describe('posts.edit', () => {
  const mine = (over: Record<string, unknown> = {}) => feedRow({ author_id: ME, ...over });
  const edit = { id: P1, title: 'Better title', body: 'Better body' };

  it('updates the text, logs the edit, and keeps clean posts clean', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: mine() }) });
    const out = await caller().board.posts.edit(edit);
    expect(db.of('board_posts', 'update')[0].payload).toMatchObject({ title: 'Better title', body: 'Better body', mod_status: 'clean' });
    expect(db.of('board_mod_events', 'insert')[0].payload).toMatchObject({ action: 'post_edit', target_id: P1 });
    expect(out.moderation.status).toBe('clean');
  });

  it('puts a verified offer back in the review queue', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: mine({ kind: 'offer', review: 'approved', verified_by: ADMIN, verified_at: ago(HOUR) }) }) });
    await caller().board.posts.edit(edit);
    expect(db.of('board_posts', 'update')[0].payload).toMatchObject({ review: 'pending', verified_by: null, verified_at: null });
  });

  it('can hold a post but never releases one that is already held — and tells the author', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: mine({ mod_status: 'held', mod_reasons: ['reports'] }) }) });
    const out = await caller().board.posts.edit(edit);
    expect(db.of('board_posts', 'update')[0].payload).toMatchObject({ mod_status: 'held', mod_reasons: ['reports'] });
    expect(out.moderation).toMatchObject({ status: 'held', reasons: ['reports'], message: expect.stringMatching(/Held for review/) });
  });

  it('rejects an edit that breaks the rules without touching the post', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: mine() }), board_blocked_terms: () => ({ data: [{ term: 'zorblax', tier: 'hard' }] }) });
    await expect(caller().board.posts.edit({ ...edit, body: 'zorblax' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.of('board_posts', 'update')).toHaveLength(0);
  });

  it('is author-only and blocked once removed', async () => {
    mockDb({ board_posts_feed: () => ({ data: feedRow({ author_id: OTHER }) }) });
    await expect(caller().board.posts.edit(edit)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    mockDb({ board_posts_feed: () => ({ data: mine({ mod_status: 'removed' }) }) });
    await expect(caller().board.posts.edit(edit)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('caps edits per post at 5 a day', async () => {
    mockDb({
      board_posts_feed: () => ({ data: mine() }),
      board_mod_events: (q) => (eqValue(q, 'action') === 'post_edit' ? { data: Array.from({ length: 5 }, (_, i) => ({ created_at: ago(i * 3 * HOUR + HOUR), target_id: P1 })) } : { data: [] }),
    });
    await expect(caller().board.posts.edit(edit)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/edited this post 5 times/) });
  });
});

describe('posts.delete', () => {
  it('soft-deletes the author\'s own post', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: feedRow({ author_id: ME }) }) });
    await expect(caller().board.posts.delete({ id: P1 })).resolves.toEqual({ ok: true });
    expect((db.of('board_posts', 'update')[0].payload as Record<string, unknown>).deleted_at).toEqual(expect.any(String));
  });

  it('404s for anyone else\'s post', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: feedRow({ author_id: OTHER }) }) });
    await expect(caller().board.posts.delete({ id: P1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.of('board_posts', 'update')).toHaveLength(0);
  });
});

// ─── votes / saves ───────────────────────────────────────────────────────────

describe('posts.vote', () => {
  const withVote = (existing: Record<string, unknown> | null, extra: Record<string, Handler> = {}) =>
    mockDb({
      board_posts_feed: () => ({ data: feedRow() }),
      board_posts: (q) => (q.single ? { data: { score: 5 } } : q.head ? { count: 4 } : { data: [] }),
      board_votes: (q) => (q.single ? { data: existing } : q.action === 'select' ? { data: [] } : undefined),
      ...extra,
    });

  it('records a first vote', async () => {
    const db = withVote(null);
    await expect(caller().board.posts.vote({ postId: P1, value: 1 })).resolves.toEqual({ score: 5, myVote: 1 });
    expect(db.of('board_votes', 'insert')[0].payload).toEqual({ user_id: ME, post_id: P1, value: 1 });
  });

  it('changes an existing vote and clears one by writing 0', async () => {
    let db = withVote({ id: 'v1', value: -1, change_count: 1 });
    await caller().board.posts.vote({ postId: P1, value: 1 });
    expect(db.of('board_votes', 'update')[0].payload).toEqual({ value: 1 });
    db = withVote({ id: 'v1', value: 1, change_count: 1 });
    await expect(caller().board.posts.vote({ postId: P1, value: 0 })).resolves.toMatchObject({ myVote: 0 });
    expect(db.of('board_votes', 'update')[0].payload).toEqual({ value: 0 });
  });

  it('does nothing for a repeated vote or clearing a vote that was never cast', async () => {
    let db = withVote({ id: 'v1', value: 1, change_count: 0 });
    await caller().board.posts.vote({ postId: P1, value: 1 });
    expect(db.of('board_votes', 'update')).toHaveLength(0);
    db = withVote(null);
    await caller().board.posts.vote({ postId: P1, value: 0 });
    expect(db.of('board_votes', 'insert')).toHaveLength(0);
  });

  it('survives a double-tap: a lost insert race applies the vote on top of the twin request\'s row', async () => {
    let lookups = 0;
    const db = withVote(null, {
      board_votes: (q) => {
        if (q.action === 'insert') return { error: { message: 'duplicate key', code: '23505' } };
        if (q.single) return { data: ++lookups === 1 ? null : { id: 'v-twin', value: 1, change_count: 0 } };
        return { data: [] };
      },
    });
    await expect(caller().board.posts.vote({ postId: P1, value: -1 })).resolves.toEqual({ score: 5, myVote: -1 });
    expect(db.of('board_votes', 'update')[0].payload).toEqual({ value: -1 });
  });

  it('is a no-op when the twin request already cast the same vote', async () => {
    let lookups = 0;
    const db = withVote(null, {
      board_votes: (q) => {
        if (q.action === 'insert') return { error: { message: 'duplicate key', code: '23505' } };
        if (q.single) return { data: ++lookups === 1 ? null : { id: 'v-twin', value: 1, change_count: 0 } };
        return { data: [] };
      },
    });
    await expect(caller().board.posts.vote({ postId: P1, value: 1 })).resolves.toMatchObject({ myVote: 1 });
    expect(db.of('board_votes', 'update')).toHaveLength(0);
  });

  it('still surfaces other insert errors', async () => {
    withVote(null, { board_votes: (q) => (q.action === 'insert' ? { error: { message: 'disk full', code: '53100' } } : q.single ? { data: null } : { data: [] }) });
    await expect(caller().board.posts.vote({ postId: P1, value: 1 })).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('locks a vote that has flapped 10 times', async () => {
    withVote({ id: 'v1', value: -1, change_count: 10 });
    await expect(caller().board.posts.vote({ postId: P1, value: 1 })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/locked until tomorrow/) });
  });

  it('caps votes at 120 an hour', async () => {
    withVote(null, {
      board_votes: (q) => (q.single ? { data: null } : { data: Array.from({ length: 120 }, (_, i) => ({ updated_at: ago(i * 1000 + 1000) })) }),
    });
    await expect(caller().board.posts.vote({ postId: P1, value: 1 })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('cannot vote on a post the viewer cannot see', async () => {
    mockDb({ board_posts_feed: () => ({ data: feedRow({ mod_status: 'held' }) }) });
    await expect(caller().board.posts.vote({ postId: P1, value: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects values outside -1, 0, 1', async () => {
    mockDb();
    await expect(caller().board.posts.vote({ postId: P1, value: 2 as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('comments.vote', () => {
  it('votes on a visible comment and returns its new score', async () => {
    const db = mockDb({
      board_posts_feed: () => ({ data: feedRow() }),
      board_comments: (q) => (q.single ? { data: q.calls.some((c) => c[0] === 'select' && c[1][0] === 'score') ? { score: 2 } : commentRow() } : undefined),
      board_votes: (q) => (q.single ? { data: null } : { data: [] }),
    });
    await expect(caller().board.comments.vote({ commentId: C1, value: 1 })).resolves.toEqual({ score: 2, myVote: 1 });
    expect(db.of('board_votes', 'insert')[0].payload).toEqual({ user_id: ME, comment_id: C1, value: 1 });
  });

  it('404s a held comment belonging to someone else', async () => {
    mockDb({ board_comments: () => ({ data: commentRow({ mod_status: 'held' }) }) });
    await expect(caller().board.comments.vote({ commentId: C1, value: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('posts.save', () => {
  it('saves and unsaves', async () => {
    const db = mockDb({ board_posts_feed: () => ({ data: feedRow() }) });
    await expect(caller().board.posts.save({ postId: P1, saved: true })).resolves.toEqual({ saved: true });
    expect(db.of('board_saves', 'upsert')[0].payload).toEqual({ user_id: ME, post_id: P1 });
    await caller().board.posts.save({ postId: P1, saved: false });
    expect(db.of('board_saves', 'delete')).toHaveLength(1);
  });
});

// ─── comments ────────────────────────────────────────────────────────────────

describe('comments.create', () => {
  const create = { postId: P1, body: 'Confirmed on my end too' };
  const useThread = (over: Record<string, Handler> = {}, post: Record<string, unknown> = {}) =>
    mockDb({
      board_posts_feed: () => ({ data: feedRow(post) }),
      board_comments: (q) => (q.action === 'insert' ? { data: commentRow({ id: C2, author_id: ME, body: create.body, parent_id: (q.payload as { parent_id: string | null }).parent_id }) } : q.single ? { data: commentRow() } : { data: [] }),
      ...over,
    });

  it('adds a comment, marks the post author as OP and gives the author their +1', async () => {
    asUser(OTHER);
    const db = useThread({ board_comments: (q) => (q.action === 'insert' ? { data: commentRow({ id: C2, author_id: OTHER, body: create.body }) } : { data: [] }) });
    const out = await caller().board.comments.create(create);
    expect(db.of('board_comments', 'insert')[0].payload).toMatchObject({ post_id: P1, parent_id: null, author_id: OTHER, body: create.body, mod_status: 'clean' });
    expect(out.comment).toMatchObject({ id: C2, body: create.body, isMine: true, isOp: true, myVote: 1, replies: [] });
    expect(db.of('board_mod_events', 'insert')[0].payload).toMatchObject({ target_kind: 'comment', action: 'auto_allow' });
  });

  it('replies to a comment on the same post', async () => {
    const db = useThread();
    const out = await caller().board.comments.create({ ...create, parentId: C1 });
    expect((db.of('board_comments', 'insert')[0].payload as Record<string, unknown>).parent_id).toBe(C1);
    expect(out.comment.parentId).toBe(C1);
  });

  it('404s a parent from another post or one the viewer cannot see', async () => {
    useThread({ board_comments: () => ({ data: commentRow({ post_id: uuid(999) }) }) });
    await expect(caller().board.comments.create({ ...create, parentId: C1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    useThread({ board_comments: () => ({ data: commentRow({ mod_status: 'held' }) }) });
    await expect(caller().board.comments.create({ ...create, parentId: C1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses locked threads, except for admins', async () => {
    useThread({}, { comments_locked: true });
    await expect(caller().board.comments.create(create)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    asUser(ADMIN, { admin: true });
    useThread({}, { comments_locked: true });
    await expect(caller().board.comments.create(create)).resolves.toBeTruthy();
  });

  it('rejects abusive comments, holds borderline ones', async () => {
    const db = useThread({ board_blocked_terms: () => ({ data: [{ term: 'zorblax', tier: 'hard' }, { term: 'quimbly', tier: 'soft' }] }) });
    await expect(caller().board.comments.create({ ...create, body: 'zorblax' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.of('board_comments', 'insert')).toHaveLength(0);
    expect(db.of('board_mod_events', 'insert')[0].payload).toMatchObject({ target_kind: 'comment', action: 'auto_reject' });

    const held = await caller().board.comments.create({ ...create, body: 'quimbly' });
    expect(held.moderation.status).toBe('held');
  });

  it('enforces the 5 s gap, 20 per post and 5 replies per comment', async () => {
    useThread({ board_comments: (q) => (q.action === 'select' && !q.single ? { data: [{ created_at: ago(2000), post_id: P1, parent_id: null }] } : { data: commentRow() }) });
    await expect(caller().board.comments.create(create)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/Slow down/) });

    const spread = (parentId: string | null, n: number) => Array.from({ length: n }, (_, i) => ({ created_at: ago(i * 10 * MIN + MIN), post_id: P1, parent_id: parentId }));
    useThread({ board_comments: (q) => (q.single ? { data: commentRow() } : { data: spread(null, 20) }) });
    await expect(caller().board.comments.create(create)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/20 comments on this post/) });

    useThread({ board_comments: (q) => (q.single ? { data: commentRow() } : { data: spread(C1, 5) }) });
    await expect(caller().board.comments.create({ ...create, parentId: C1 })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', message: expect.stringMatching(/5 replies to this comment/) });
  });

  it('lets authors delete their own comment only', async () => {
    const db = mockDb({ board_comments: (q) => (q.single ? { data: { id: C1, author_id: ME, deleted_at: null } } : undefined) });
    await expect(caller().board.comments.delete({ id: C1 })).resolves.toEqual({ ok: true });
    expect(db.of('board_comments', 'update')).toHaveLength(1);
    mockDb({ board_comments: (q) => (q.single ? { data: { id: C1, author_id: OTHER, deleted_at: null } } : undefined) });
    await expect(caller().board.comments.delete({ id: C1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ─── report ──────────────────────────────────────────────────────────────────

describe('report', () => {
  const report = { kind: 'post' as const, id: P1, reason: 'Spam' as const };
  const withReports = (count: number, over: Record<string, Handler> = {}) =>
    mockDb({
      board_posts_feed: () => ({ data: feedRow() }),
      board_reports: (q) => (q.head ? { count } : q.action === 'insert' ? { data: null } : { data: [] }),
      ...over,
    });

  it('files a report and holds nothing below 3 reporters', async () => {
    const db = withReports(2);
    await expect(caller().board.report(report)).resolves.toEqual({ ok: true, held: false });
    expect(db.of('board_reports', 'insert')[0].payload).toEqual({ target_kind: 'post', target_id: P1, reporter_id: ME, reason: 'Spam', note: null });
    expect(db.of('board_posts', 'update')).toHaveLength(0);
  });

  it('auto-holds at 3 distinct reporters and audits it', async () => {
    const db = withReports(3);
    await expect(caller().board.report(report)).resolves.toEqual({ ok: true, held: true });
    expect(db.of('board_posts', 'update')[0].payload).toEqual({ mod_status: 'held', mod_reasons: ['reports'] });
    expect(db.of('board_mod_events', 'insert')[0].payload).toMatchObject({ action: 'reports_hold', target_id: P1 });
  });

  it('holds a reported comment too', async () => {
    const db = withReports(3, {
      board_comments: () => ({ data: commentRow() }),
    });
    await caller().board.report({ kind: 'comment', id: C1, reason: 'Offensive' });
    expect(db.of('board_comments', 'update')[0].payload).toMatchObject({ mod_status: 'held' });
  });

  it('never holds on an admin report, and does not re-hold a held post', async () => {
    asUser(ADMIN, { admin: true });
    let db = withReports(9);
    await expect(caller().board.report(report)).resolves.toMatchObject({ held: false });
    expect(db.of('board_posts', 'update')).toHaveLength(0);

    asUser(ME);
    db = withReports(9, { board_posts_feed: () => ({ data: feedRow({ mod_status: 'held' }) }) });
    // a held post is hidden from non-authors, so it cannot be reported by them
    await expect(caller().board.report(report)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.of('board_reports', 'insert')).toHaveLength(0);
  });

  it('refuses reports on your own content and duplicate reports', async () => {
    withReports(0, { board_posts_feed: () => ({ data: feedRow({ author_id: ME }) }) });
    await expect(caller().board.report(report)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    withReports(0, { board_reports: (q) => (q.action === 'insert' ? { error: { message: 'dup', code: '23505' } } : { data: [] }) });
    await expect(caller().board.report(report)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('caps reports at 10 an hour', async () => {
    withReports(0, { board_reports: (q) => (q.head ? { count: 0 } : q.action === 'select' ? { data: Array.from({ length: 10 }, (_, i) => ({ created_at: ago(i * MIN + MIN) })) } : undefined) });
    await expect(caller().board.report(report)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

// ─── topics / offers / limits ────────────────────────────────────────────────

describe('topics.list', () => {
  const active = topic(uuid(110), 'Airport lounges', 'airport lounge', { status: 'active' });
  const dormant = topic(uuid(111), 'Old topic', 'old topic', { status: 'dormant' });
  const shared = [dormant, active, ...TOPICS];
  const withTopics = (extra: Record<string, Handler> = {}) =>
    mockDb({ board_topics: (q) => (eqValue(q, 'created_by') ? { data: [topic(uuid(112), 'Mine', 'mine', { status: 'provisional' })] } : { data: shared }), ...extra },
      { board_topic_activity: () => [{ topic_id: T_AWARD, posts_30d: 4, authors_30d: 2 }, { topic_id: uuid(110), posts_30d: 1, authors_30d: 1 }, { topic_id: uuid(111), posts_30d: 50, authors_30d: 9 }] });

  it('orders common, then active, then dormant — by recent activity within each — and caches it', async () => {
    asUser(null);
    withTopics();
    const out = await caller().board.topics.list({});
    expect(out.map((t) => t.name)).toEqual(['Award flights', 'Hotels', 'Statement credits', 'Transfer bonuses', 'Airport lounges', 'Old topic']);
    expect(out[0].activity).toBe(8);
    expect(redis.set).toHaveBeenCalledWith('board:topics', expect.any(Array), { ex: 300 });
  });

  it('serves the cache without touching the database', async () => {
    const cached = [{ id: T_HOTEL, name: 'Hotels', key: 'hotel', status: 'common', activity: 1 }];
    vi.mocked(redis.get).mockResolvedValue(cached);
    asUser(null);
    const db = withTopics();
    await expect(caller().board.topics.list({})).resolves.toEqual(cached);
    expect(db.of('board_topics')).toHaveLength(0);
  });

  it('adds the viewer\'s own provisional topics, never anyone else\'s, and filters by q', async () => {
    withTopics();
    const mine = await caller().board.topics.list({});
    expect(mine.map((t) => t.name)).toContain('Mine');
    asUser(null);
    withTopics();
    expect((await caller().board.topics.list({})).map((t) => t.name)).not.toContain('Mine');
    expect((await caller().board.topics.list({ q: 'lounge' })).map((t) => t.name)).toEqual(['Airport lounges']);
  });

  it('skips Redis entirely when the board cache flag is off — reads, writes and busts', async () => {
    flagState.off.add('integration:redis:board');
    withTopics();
    await caller().board.topics.list({});
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();

    mockDb();
    await caller().board.posts.create(tipInput);
    expect(redis.del).not.toHaveBeenCalled();
  });
});

describe('topics.resolve', () => {
  it('previews the ladder: exact, invalid, blocked, suggestions', async () => {
    mockDb({ board_blocked_terms: () => ({ data: [{ term: 'zorblax', tier: 'hard' }] }) },
      { board_similar_topics: (a) => (a.min_similarity === 0.6 ? [{ id: T_AWARD, name: 'Award flights', key: 'award flight', status: 'common', similarity: 0.7 }] : []) });
    expect(await caller().board.topics.resolve({ name: 'hotels' })).toMatchObject({ valid: true, exact: { id: T_HOTEL } });
    expect(await caller().board.topics.resolve({ name: 'x' })).toMatchObject({ valid: false });
    expect(await caller().board.topics.resolve({ name: 'zorblax' })).toMatchObject({ valid: false, error: 'That topic name breaks the board rules.' });
    const near = await caller().board.topics.resolve({ name: 'award tips' });
    expect(near).toMatchObject({ valid: true, exact: null });
    expect(near.suggestions.map((t) => t.id)).toEqual([T_AWARD]);
  });

  it('requires sign-in', async () => {
    asUser(null);
    mockDb();
    await expect(caller().board.topics.resolve({ name: 'hotels' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('offers.search', () => {
  it('queries only live approved offers and resolves issuer names', async () => {
    const db = mockDb({
      transfer_bonuses: () => ({ data: [{ id: OFFER1, issuer: 'chase', transfer_partner: 'United MileagePlus', bonus_pct: 25, end_date: '2099-01-01', description: null, source_url: null }] }),
      spending_bonuses: () => ({ data: [] }),
    });
    const out = await caller().board.offers.search({ q: 'chase' });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: 'catalog', table: 'transfer_bonuses', id: OFFER1 });
    const q = db.of('transfer_bonuses')[0];
    expect(called(q, 'eq', 'active', true)).toBe(true);
    expect(called(q, 'in', 'status', ['admin', 'approved'])).toBe(true);
    const ors = q.calls.filter((c) => c[0] === 'or').map((c) => c[1][0] as string);
    expect(ors[0]).toMatch(/^end_date\.is\.null,end_date\.gte\.\d{4}-\d\d-\d\d$/);
    expect(ors[1]).toBe('transfer_partner.ilike.%chase%,issuer.eq.chase');
  });

  it('interleaves both tables by end date instead of letting one crowd out the other', async () => {
    const day = (n: number) => new Date(NOW + n * 24 * HOUR).toISOString().slice(0, 10);
    const transfers = Array.from({ length: 20 }, (_, i) => ({ id: uuid(700 + i), issuer: 'chase', transfer_partner: `T${i}`, bonus_pct: 20, end_date: day(10 + i), description: null, source_url: null }));
    const spendings = [
      { id: uuid(800), issuer: 'amex', merchant_name: 'Soonest', bonus_multiplier: 5, bonus_type: 'points_multiplier', end_date: day(1), description: null, source_url: null },
      { id: uuid(801), issuer: 'amex', merchant_name: 'Ongoing', bonus_multiplier: 3, bonus_type: 'points_multiplier', end_date: null, description: null, source_url: null },
    ];
    mockDb({ transfer_bonuses: () => ({ data: transfers }), spending_bonuses: () => ({ data: spendings }) });
    const out = await caller().board.offers.search({});
    expect(out).toHaveLength(20);
    expect(out[0].id).toBe(uuid(800));                       // soonest spending offer is not dropped
    expect(out.map((o) => o.id)).not.toContain(uuid(801));   // no end date sorts last, behind 19 dated offers
    expect(out.slice(1).map((o) => o.id)).toEqual(transfers.slice(0, 19).map((t) => t.id));
  });

  it('strips characters that would break the or() filter', async () => {
    const db = mockDb();
    await caller().board.offers.search({ q: 'a,b(c)%*' });
    const ors = db.of('transfer_bonuses')[0].calls.filter((c) => c[0] === 'or').map((c) => c[1][0] as string);
    expect(ors[1]).toBe('transfer_partner.ilike.%a b c%');
  });
});

describe('limits.me', () => {
  it('reports what is left in each window', async () => {
    mockDb({ board_posts: (q) => (q.head ? { count: 4 } : q.action === 'select' ? { data: [{ created_at: ago(20 * MIN), kind: 'tip', member_offer_id: null, offer_table: null, offer_id: null }] } : undefined) });
    const out = await caller().board.limits.me();
    expect(out.standing).toBe('normal');
    expect(out.post).toEqual({ hour: 4, day: 9 });
    expect(out.topicCreate).toEqual({ hour: null, day: 6 });
    expect(out.blocked).toBeNull();
    expect(out.postCooldownSeconds).toBe(0);
  });

  it('says so when the member cannot write', async () => {
    mockDb({ board_author_standing: () => ({ data: { standing: 'banned' } }) });
    expect((await caller().board.limits.me()).blocked).toEqual({ message: "Your account can't post on the board.", retryAt: null });
  });

  it('returns unlimited quota for admins', async () => {
    asUser(ADMIN, { admin: true });
    mockDb();
    expect((await caller().board.limits.me()).post).toEqual({ hour: null, day: null });
  });
});
