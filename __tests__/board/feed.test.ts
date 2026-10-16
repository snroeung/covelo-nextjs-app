import { describe, it, expect } from 'vitest';
import { hotScore, sortKey, compareForFeed, encodeCursor, decodeCursor, isAfterCursor, type RankablePost } from '@/lib/board/hot';

const NOW = new Date('2026-10-13T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const post = (id: string, score: number, ageH: number): RankablePost => ({ id: `00000000-0000-0000-0000-00000000000${id}`, score, createdAt: hoursAgo(ageH) });

describe('hotScore', () => {
  it('matches score / (age + 2)^1.4', () => {
    expect(hotScore(142, hoursAgo(2), NOW)).toBeCloseTo(142 / Math.pow(4, 1.4), 10);
    expect(hotScore(10, hoursAgo(0), NOW)).toBeCloseTo(10 / Math.pow(2, 1.4), 10);
  });

  it('decays with age and treats future timestamps as age 0', () => {
    expect(hotScore(10, hoursAgo(1), NOW)).toBeGreaterThan(hotScore(10, hoursAgo(10), NOW));
    expect(hotScore(10, new Date(NOW.getTime() + 3_600_000), NOW)).toBe(hotScore(10, NOW, NOW));
  });
});

describe('feed ordering', () => {
  const posts = [post('1', 142, 2), post('2', 88, 5), post('3', 31, 0.6), post('4', 64, 26)];

  it('sorts by hot, new and top', () => {
    const ids = (s: 'hot' | 'new' | 'top') => [...posts].sort((a, b) => compareForFeed(a, b, s, NOW)).map((p) => p.id.slice(-1));
    expect(ids('new')).toEqual(['3', '1', '2', '4']);
    expect(ids('top')).toEqual(['1', '2', '4', '3']);
    expect(ids('hot')[0]).toBe('1');
    expect(ids('hot').at(-1)).toBe('4');
  });

  it('breaks ties by id so the order is total', () => {
    const a = post('1', 5, 1);
    const b = { ...post('2', 5, 1) };
    expect(compareForFeed(a, b, 'top', NOW)).toBeGreaterThan(0);
    expect(compareForFeed(b, a, 'top', NOW)).toBeLessThan(0);
  });
});

describe('cursors', () => {
  const p = post('1', 142, 2);

  it('round-trips and is URL-safe', () => {
    const c = { s: 'top' as const, k: sortKey(p, 'top', NOW), id: p.id };
    const raw = encodeCursor(c);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(raw, 'top')).toEqual(c);
  });

  it('rejects malformed cursors and cursors from another sort', () => {
    expect(decodeCursor('not-a-cursor', 'top')).toBeNull();
    expect(decodeCursor(null, 'top')).toBeNull();
    expect(decodeCursor(encodeCursor({ s: 'new', k: 1, id: p.id }), 'top')).toBeNull();
    expect(decodeCursor(encodeCursor({ s: 'top', k: 1, id: 'nope' } as never), 'top')).toBeNull();
  });

  it('isAfterCursor pages strictly past the cursor', () => {
    const c = { s: 'top' as const, k: 50, id: post('5', 0, 0).id };
    expect(isAfterCursor(post('1', 49, 1), c, NOW)).toBe(true);
    expect(isAfterCursor(post('9', 50, 1), c, NOW)).toBe(false);
    expect(isAfterCursor(post('1', 50, 1), c, NOW)).toBe(true);
    expect(isAfterCursor(post('1', 51, 1), c, NOW)).toBe(false);
  });
});
