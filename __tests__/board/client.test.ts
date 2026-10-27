import { describe, it, expect } from 'vitest';
import { timeAgo, pluralize, untilLabel } from '@/lib/board/format';
import { parseFilters, filtersToSearch, feedInput, hasActiveFilters, DEFAULT_FILTERS, MAX_QUERY } from '@/lib/board/filters';
import {
  scoreAfterVote, applyPostVote, applyCommentVote, toggleVote, patchPostInFeed, removePostFromFeed,
  mapComment, insertComment, countComments, sortThread, type FeedData,
} from '@/lib/board/cache';
import { describeError, isRateLimited } from '@/lib/board/errors';
import type { BoardComment, BoardPost } from '@/lib/board/types';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

describe('timeAgo', () => {
  it.each([
    [10_000, '1m'], [29 * MIN, '29m'], [59 * MIN, '59m'], [HOUR, '1h'], [5 * HOUR + 20 * MIN, '5h'],
    [DAY, '1d'], [3 * DAY, '3d'], [13 * DAY, '13d'], [21 * DAY, '3w'], [59 * DAY, '8w'], [75 * DAY, '3mo'],
  ])('%i ms → %s', (ms, label) => {
    expect(timeAgo(ago(ms), NOW)).toBe(label);
  });

  it('never goes negative for a timestamp slightly in the future', () => {
    expect(timeAgo(new Date(NOW + 5000).toISOString(), NOW)).toBe('1m');
  });

  it('is empty for garbage', () => {
    expect(timeAgo('not a date', NOW)).toBe('');
  });
});

describe('pluralize / untilLabel', () => {
  it('pluralizes', () => {
    expect(pluralize(1, 'comment')).toBe('1 comment');
    expect(pluralize(0, 'comment')).toBe('0 comments');
    expect(pluralize(2, 'reply', 'replies')).toBe('2 replies');
  });

  it('describes a wait', () => {
    expect(untilLabel(new Date(NOW + 134 * MIN).toISOString(), NOW)).toBe('2 h 14 m');
    expect(untilLabel(new Date(NOW + 2 * HOUR).toISOString(), NOW)).toBe('2 h');
    expect(untilLabel(new Date(NOW + 40 * MIN).toISOString(), NOW)).toBe('40 m');
    expect(untilLabel(new Date(NOW - 1000).toISOString(), NOW)).toBe('a moment');
    expect(untilLabel('nope', NOW)).toBe('a moment');
  });
});

describe('feed filters in the URL', () => {
  const TOPIC = '123e4567-e89b-42d3-a456-426614174000';
  const from = (qs: string) => parseFilters(new URLSearchParams(qs));

  it('defaults when the URL is bare', () => {
    expect(from('')).toEqual(DEFAULT_FILTERS);
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe('');
  });

  it('round-trips every filter', () => {
    const f = { type: 'offer' as const, topic: TOPIC, q: 'hyatt', verified: true, sort: 'new' as const };
    expect(from(filtersToSearch(f).slice(1))).toEqual(f);
  });

  it('writes only what differs from the default', () => {
    expect(filtersToSearch({ ...DEFAULT_FILTERS, sort: 'top' })).toBe('?sort=top');
    expect(filtersToSearch({ ...DEFAULT_FILTERS, type: 'tip' })).toBe('?type=tip');
  });

  it('ignores junk values instead of throwing', () => {
    expect(from('type=weird&sort=sideways&topic=not-a-guid&verified=yes')).toEqual(DEFAULT_FILTERS);
  });

  it('caps and trims the search text', () => {
    expect(from(`q=${'a'.repeat(300)}`).q).toHaveLength(MAX_QUERY);
    expect(filtersToSearch({ ...DEFAULT_FILTERS, q: '  hyatt  ' })).toBe('?q=hyatt');
    expect(filtersToSearch({ ...DEFAULT_FILTERS, q: '   ' })).toBe('');
  });

  it('drops "verified only" while browsing tips', () => {
    expect(filtersToSearch({ ...DEFAULT_FILTERS, type: 'tip', verified: true })).toBe('?type=tip');
    expect(feedInput({ ...DEFAULT_FILTERS, type: 'tip', verified: true }).verified).toBeUndefined();
    expect(feedInput({ ...DEFAULT_FILTERS, verified: true }).verified).toBe(true);
  });

  it('builds the tRPC input, omitting empties', () => {
    expect(feedInput(DEFAULT_FILTERS)).toEqual({ type: undefined, topic: undefined, q: undefined, verified: undefined, sort: 'hot' });
    expect(feedInput({ type: 'offer', topic: TOPIC, q: ' x ', verified: false, sort: 'top' })).toEqual({ type: 'offer', topic: TOPIC, q: 'x', verified: undefined, sort: 'top' });
  });

  it('knows when a filter is narrowing the feed (sort alone is not)', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'new' })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, verified: true })).toBe(true);
  });
});

const author = { name: 'a', initials: 'A', tone: 'blue' as const, isSystem: false };
const post = (over: Partial<BoardPost> = {}): BoardPost => ({
  id: 'p1', kind: 'tip', title: 't', body: '', author, isMine: false, createdAt: ago(HOUR), topics: [], score: 5, myVote: 0,
  saved: false, commentCount: 0, commentsLocked: false, offer: null, review: null, verified: null, notice: null, mod: null, ...over,
});
const comment = (id: string, over: Partial<BoardComment> = {}): BoardComment => ({
  id, postId: 'p1', parentId: null, author, isMine: false, isOp: false, body: id, createdAt: ago(HOUR), score: 0, myVote: 0, notice: null, mod: null, replies: [], ...over,
});

describe('optimistic votes', () => {
  it('moves the score by the change in the viewer\'s own vote', () => {
    expect(scoreAfterVote(5, 0, 1)).toBe(6);
    expect(scoreAfterVote(5, 1, 0)).toBe(4);
    expect(scoreAfterVote(5, 1, -1)).toBe(3);
    expect(scoreAfterVote(5, -1, 1)).toBe(7);
    expect(scoreAfterVote(5, 0, -1)).toBe(4);
  });

  it('applies to posts and comments without mutating them', () => {
    const p = post({ score: 5, myVote: 1 });
    expect(applyPostVote(p, -1)).toMatchObject({ score: 3, myVote: -1 });
    expect(p).toMatchObject({ score: 5, myVote: 1 });
    expect(applyCommentVote(comment('c', { score: 2 }), 1)).toMatchObject({ score: 3, myVote: 1 });
  });

  it('clicking your own vote clears it; clicking the other flips it', () => {
    expect(toggleVote(0, 1)).toBe(1);
    expect(toggleVote(1, 1)).toBe(0);
    expect(toggleVote(1, -1)).toBe(-1);
    expect(toggleVote(-1, -1)).toBe(0);
    expect(toggleVote(-1, 1)).toBe(1);
  });
});

describe('feed cache', () => {
  const data = (): FeedData => ({
    pageParams: [null, 'c'],
    pages: [
      { posts: [post({ id: 'a' }), post({ id: 'b' })], nextCursor: 'c', counts: { all: 3, byTopic: {} } },
      { posts: [post({ id: 'c' })], nextCursor: null, counts: null },
    ],
  });

  it('patches one post wherever it is, leaving the rest and the page metadata alone', () => {
    const out = patchPostInFeed(data(), 'c', (p) => ({ ...p, saved: true }))!;
    expect(out.pages[1].posts[0].saved).toBe(true);
    expect(out.pages[0].posts.every((p) => !p.saved)).toBe(true);
    expect(out.pages[0].counts).toEqual({ all: 3, byTopic: {} });
    expect(out.pageParams).toEqual([null, 'c']);
  });

  it('removes a post', () => {
    expect(removePostFromFeed(data(), 'b')!.pages[0].posts.map((p) => p.id)).toEqual(['a']);
  });

  it('passes undefined through (nothing cached yet)', () => {
    expect(patchPostInFeed(undefined, 'a', (p) => p)).toBeUndefined();
    expect(removePostFromFeed(undefined, 'a')).toBeUndefined();
  });
});

describe('comment trees', () => {
  const tree = (): BoardComment[] => [
    comment('r1', { score: 3, createdAt: ago(3 * HOUR), replies: [comment('r1a', { score: 1, createdAt: ago(2 * HOUR), replies: [comment('r1a1')] }), comment('r1b', { score: 9, createdAt: ago(HOUR) })] }),
    comment('r2', { score: 8, createdAt: ago(HOUR) }),
  ];

  it('updates a nested comment in place', () => {
    const out = mapComment(tree(), 'r1a1', (c) => ({ ...c, body: 'edited' }));
    expect(out[0].replies[0].replies[0].body).toBe('edited');
    expect(out[1].body).toBe('r2');
  });

  it('adds a root comment first and a reply to the end of its parent', () => {
    const root = insertComment(tree(), comment('new'));
    expect(root.map((c) => c.id)).toEqual(['new', 'r1', 'r2']);
    const reply = insertComment(tree(), comment('rep', { parentId: 'r1a' }));
    expect(reply[0].replies[0].replies.map((c) => c.id)).toEqual(['r1a1', 'rep']);
  });

  it('counts every comment at every depth', () => {
    expect(countComments(tree())).toBe(5);
    expect(countComments([])).toBe(0);
  });

  it('sorts the whole thread by top (score, then newest) or by newest', () => {
    const top = sortThread(tree(), 'top');
    expect(top.map((c) => c.id)).toEqual(['r2', 'r1']);
    expect(top[1].replies.map((c) => c.id)).toEqual(['r1b', 'r1a']);
    const newest = sortThread(tree(), 'new');
    expect(newest.map((c) => c.id)).toEqual(['r2', 'r1']);
    expect(newest[1].replies.map((c) => c.id)).toEqual(['r1b', 'r1a']);
  });

  it('does not mutate its input', () => {
    const t = tree();
    sortThread(t, 'top');
    expect(t.map((c) => c.id)).toEqual(['r1', 'r2']);
  });
});

describe('describeError', () => {
  const trpc = (message: string, data: Record<string, unknown> = {}) => ({ message, data });

  it('passes a plain server message through, with its code', () => {
    expect(describeError(trpc('You already posted this offer in the last 7 days.', { code: 'CONFLICT' }))).toEqual({
      message: 'You already posted this offer in the last 7 days.', code: 'CONFLICT', retryAt: null,
    });
  });

  it('carries a rate limit\'s retry time', () => {
    const e = describeError(trpc('You can post again in 2 h — limit is 10 posts per day.', { code: 'TOO_MANY_REQUESTS', retryAt: '2026-10-17T14:00:00.000Z' }));
    expect(e).toMatchObject({ code: 'TOO_MANY_REQUESTS', retryAt: '2026-10-17T14:00:00.000Z' });
    expect(isRateLimited(e)).toBe(true);
  });

  it('turns zod issue arrays into a sentence', () => {
    const issues = (i: object[]) => JSON.stringify(i);
    expect(describeError(trpc(issues([{ code: 'too_small', minimum: 1, path: ['title'], message: 'Too small: expected string to have >=1 characters' }]), { code: 'BAD_REQUEST' })).message).toBe('Title is required.');
    expect(describeError(trpc(issues([{ code: 'too_big', maximum: 200, path: ['title'], message: 'x' }]))).message).toBe('Title is too long (max 200).');
    expect(describeError(trpc(issues([{ code: 'too_small', minimum: 1, path: ['newOffer', 'value'], message: 'x' }]))).message).toBe('Value is required.');
    expect(describeError(trpc(issues([{ code: 'custom', path: ['link'], message: 'Link a covelo offer or create a new one.' }]))).message).toBe('Link a covelo offer or create a new one.');
  });

  it('only reads the first issue and survives bad JSON', () => {
    expect(describeError(trpc(JSON.stringify([{ code: 'too_small', minimum: 1, path: ['title'] }, { code: 'too_small', minimum: 1, path: ['body'] }]))).message).toBe('Title is required.');
    expect(describeError(trpc('[not json')).message).toBe('[not json');
  });

  it('recognises a network failure and a missing session', () => {
    expect(describeError(new TypeError('Failed to fetch')).message).toMatch(/Can't reach covelo/);
    expect(describeError(trpc('Sign in required.', { code: 'UNAUTHORIZED' })).message).toBe('Sign in to do that.');
  });

  it('has a fallback for anything', () => {
    expect(describeError(null).message).toBe('Something went wrong. Try again.');
    expect(describeError({}).message).toBe('Something went wrong. Try again.');
    expect(describeError('boom').message).toBe('Something went wrong. Try again.');
  });
});

import {
  addExisting, addNew, removeSelection, toTopicInputs, selectionError, canAddNew, newCount, MAX_TOPICS, MAX_NEW_TOPICS, type TopicSelection,
} from '@/lib/board/topicSelection';

describe('topic selection', () => {
  const t = (n: number) => ({ id: `id-${n}`, name: `Topic ${n}`, key: `topic ${n}` });
  const n = (k: string) => ({ name: k.toUpperCase(), key: k });

  it('keeps the order picked — the first is the main topic', () => {
    let sel: TopicSelection[] = [];
    sel = addExisting(sel, t(1));
    sel = addNew(sel, n('lounges'));
    sel = addExisting(sel, t(2));
    expect(toTopicInputs(sel)).toEqual([{ id: 'id-1' }, { name: 'LOUNGES' }, { id: 'id-2' }]);
  });

  it('ignores repeats', () => {
    const once = addExisting([], t(1));
    expect(addExisting(once, t(1))).toEqual(once);
    const newOnce = addNew([], n('lounges'));
    expect(addNew(newOnce, n('lounges'))).toEqual(newOnce);
  });

  it('allows at most 5 topics in total', () => {
    let sel: TopicSelection[] = [];
    for (let i = 1; i <= 8; i++) sel = addExisting(sel, t(i));
    expect(sel).toHaveLength(MAX_TOPICS);
    expect(addNew(sel, n('extra'))).toHaveLength(MAX_TOPICS);
  });

  it('allows at most 3 brand-new topics, even with room left overall', () => {
    let sel: TopicSelection[] = [];
    for (const k of ['a1', 'b2', 'c3', 'd4']) sel = addNew(sel, n(k));
    expect(newCount(sel)).toBe(MAX_NEW_TOPICS);
    expect(canAddNew(sel)).toBe(false);
    expect(addExisting(sel, t(1))).toHaveLength(4); // existing topics are still welcome
  });

  it('removes one selection without touching the rest, existing or new', () => {
    const sel = addNew(addExisting(addExisting([], t(1)), t(2)), n('x1'));
    expect(removeSelection(sel, sel[0]).map((s) => s.name)).toEqual(['Topic 2', 'X1']);
    expect(removeSelection(sel, sel[2]).map((s) => s.name)).toEqual(['Topic 1', 'Topic 2']);
  });

  it('frees up a new-topic slot when one is removed', () => {
    let sel: TopicSelection[] = [];
    for (const k of ['a1', 'b2', 'c3']) sel = addNew(sel, n(k));
    sel = removeSelection(sel, sel[1]);
    expect(canAddNew(sel)).toBe(true);
  });

  it('explains why it can\'t be posted', () => {
    expect(selectionError([])).toBe('Pick at least one topic.');
    expect(selectionError(addExisting([], t(1)))).toBeNull();
  });
});
