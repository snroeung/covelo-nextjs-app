import { vi, beforeEach, describe, it, expect } from 'vitest';
import { makeDb, eqValue, type Handler } from './utils/fakeDb';
import { ADMIN, OFFER1, P1, T_HOTEL, T_TRANSFER, TOPICS, topic, ago, HOUR } from './utils/fixtures';

vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: () => true }));

import { redis } from '@/lib/redis';
import { assertBoardPostReady, syncSystemPost, type OfferBoardFields } from '@/lib/board/server/systemPost';

const on = (over: Partial<OfferBoardFields> = {}): OfferBoardFields => ({
  post_to_board: true, board_topic: 'Transfer bonuses', board_post_title: '  Bilt → World of Hyatt +30% is live  ', board_post_body: ' One-time transfers only. ', ...over,
});

/** `systemPosts` = what the lookup for this offer's covelo post finds. */
function setup(systemPosts: Array<Record<string, unknown>>, over: Record<string, Handler> = {}) {
  const db = makeDb({
    board_posts: (q) => (q.action === 'insert' ? { data: { id: P1 } } : q.action === 'select' ? { data: systemPosts } : undefined),
    board_topics: () => ({ data: TOPICS }),
    ...over,
  });
  return db;
}
const sync = (db: ReturnType<typeof setup>, fields: OfferBoardFields) =>
  syncSystemPost(db.client as never, 'transfer_bonuses', OFFER1, fields, ADMIN);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.del).mockResolvedValue(1);
});

describe('assertBoardPostReady', () => {
  it('needs a title and a topic', () => {
    expect(() => assertBoardPostReady({ board_post_title: '  ', board_topic: 'Hotels' })).toThrow(/title/);
    expect(() => assertBoardPostReady({ board_post_title: null, board_topic: 'Hotels' })).toThrow(/title/);
    expect(() => assertBoardPostReady({ board_post_title: 'Hi', board_topic: '' })).toThrow(/topic/);
    expect(() => assertBoardPostReady({ board_post_title: 'Hi', board_topic: 'Hotels' })).not.toThrow();
  });
});

describe('syncSystemPost — posting', () => {
  it('creates covelo\'s post: no author, approved by the acting admin, stored text trimmed, primary topic linked', async () => {
    const db = setup([]);
    await expect(sync(db, on())).resolves.toBe('posted');

    expect(db.of('board_posts', 'insert')[0].payload).toEqual({
      kind: 'offer', author_id: null, is_system: true, offer_table: 'transfer_bonuses', offer_id: OFFER1,
      title: 'Bilt → World of Hyatt +30% is live', body: 'One-time transfers only.', search_extra: 'covelo Transfer bonuses',
      topic_id: T_TRANSFER, review: 'approved', verified_by: ADMIN, verified_at: expect.any(String), reject_reason: null,
      mod_status: 'clean', mod_reasons: [], deleted_at: null,
    });
    expect(db.of('board_post_topics', 'insert')[0].payload).toEqual({ post_id: P1, topic_id: T_TRANSFER, is_primary: true, created_new: false });
    expect(redis.del).toHaveBeenCalledWith('board:topics');
  });

  it('uses the text as stored — nothing is regenerated, an empty body stays empty', async () => {
    const db = setup([]);
    await sync(db, on({ board_post_title: 'Exactly this', board_post_body: null }));
    expect(db.of('board_posts', 'insert')[0].payload).toMatchObject({ title: 'Exactly this', body: '' });
  });

  it('matches the topic by key, so case and plurals do not matter', async () => {
    const db = setup([]);
    await sync(db, on({ board_topic: 'HOTEL' }));
    expect((db.of('board_posts', 'insert')[0].payload as Record<string, unknown>).topic_id).toBe(T_HOTEL);
  });

  it('follows a merged topic to where its posts now live', async () => {
    const merged = topic('m-1', 'Lodging', 'lodging', { status: 'hidden', merged_into_id: T_HOTEL });
    const db = setup([], { board_topics: () => ({ data: [...TOPICS, merged] }) });
    await sync(db, on({ board_topic: 'Lodging' }));
    expect((db.of('board_posts', 'insert')[0].payload as Record<string, unknown>).topic_id).toBe(T_HOTEL);
  });

  it.each([
    ['an unknown topic', { board_topic: 'No such topic' }],
    ['a hidden topic with nowhere to go', { board_topic: 'Gone' }],
  ])('refuses %s without writing anything', async (_name, patch) => {
    const gone = topic('g-1', 'Gone', 'gone', { status: 'hidden' });
    const db = setup([], { board_topics: () => ({ data: [...TOPICS, gone] }) });
    await expect(sync(db, on(patch))).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/Unknown board topic/) });
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
  });

  it('refuses a missing title or topic', async () => {
    const db = setup([]);
    await expect(sync(db, on({ board_post_title: ' ' }))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(sync(db, on({ board_topic: null }))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('removes the half-made post if its topic link fails', async () => {
    const db = setup([], { board_post_topics: () => ({ error: { message: 'link failed' } }) });
    await expect(sync(db, on())).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(db.of('board_posts', 'delete')).toHaveLength(1);
  });
});

describe('syncSystemPost — updating and reviving', () => {
  it('updates the existing post in place and demotes (not drops) the old primary topic', async () => {
    const db = setup([{ id: P1, deleted_at: null }], {
      board_post_topics: (q) => (q.single ? { data: { topic_id: T_HOTEL } } : undefined),
    });
    await expect(sync(db, on())).resolves.toBe('updated');
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
    expect(db.of('board_posts', 'update')[0].payload).toMatchObject({ title: 'Bilt → World of Hyatt +30% is live', topic_id: T_TRANSFER, deleted_at: null });
    // old primary → secondary, new topic → primary; the unique one-primary index needs that order
    const links = db.of('board_post_topics');
    expect(links.map((q) => q.action)).toEqual(['select', 'update', 'upsert']);
    expect(links[1].payload).toEqual({ is_primary: false });
    expect(links[2].payload).toEqual({ post_id: P1, topic_id: T_TRANSFER, is_primary: true });
  });

  it('revives a hidden post — same row, so its votes and comments come back', async () => {
    const db = setup([{ id: P1, deleted_at: ago(HOUR) }], {
      board_post_topics: (q) => (q.single ? { data: { topic_id: T_TRANSFER } } : undefined),
    });
    await expect(sync(db, on())).resolves.toBe('updated');
    expect(db.of('board_posts', 'insert')).toHaveLength(0);
    expect(db.of('board_posts', 'update')[0].payload).toMatchObject({ deleted_at: null });
    expect(eqValue(db.of('board_posts', 'update')[0], 'id')).toBe(P1);
  });
});

describe('syncSystemPost — taking it down', () => {
  it('soft-deletes the live post rather than deleting it', async () => {
    const db = setup([{ id: P1, deleted_at: null }]);
    await expect(sync(db, on({ post_to_board: false }))).resolves.toBe('hidden');
    expect((db.of('board_posts', 'update')[0].payload as Record<string, unknown>).deleted_at).toEqual(expect.any(String));
    expect(db.of('board_posts', 'delete')).toHaveLength(0);
    expect(redis.del).toHaveBeenCalledWith('board:topics');
  });

  it('does nothing when there is no post, or it is already hidden — and needs no title or topic', async () => {
    let db = setup([]);
    await expect(sync(db, { post_to_board: false, board_topic: null, board_post_title: null, board_post_body: null })).resolves.toBe('none');
    db = setup([{ id: P1, deleted_at: ago(HOUR) }]);
    await expect(sync(db, on({ post_to_board: false }))).resolves.toBe('none');
    expect(db.of('board_posts', 'update')).toHaveLength(0);
  });

  it('looks up only this offer\'s covelo post, newest first', async () => {
    const db = setup([]);
    await sync(db, on({ post_to_board: false }));
    const q = db.of('board_posts', 'select')[0];
    expect(eqValue(q, 'is_system')).toBe(true);
    expect(eqValue(q, 'offer_table')).toBe('transfer_bonuses');
    expect(eqValue(q, 'offer_id')).toBe(OFFER1);
  });
});
