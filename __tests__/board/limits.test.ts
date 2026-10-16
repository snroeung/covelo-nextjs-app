import { describe, it, expect } from 'vitest';
import {
  BOARD_LIMITS, BOARD_PER_POST_LIMITS, checkRateLimit, checkCooldown, checkRejectLock, checkPostTopics,
  checkPerTarget, effectiveLimits, formatWait, isNewAccount, remaining, type LimitContext,
} from '@/lib/board/limits';

const NOW = new Date('2026-10-13T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const times = (n: number, everyMins: number, startMinsAgo = 0) => Array.from({ length: n }, (_, i) => minsAgo(startMinsAgo + i * everyMins));

const ctx = (over: Partial<LimitContext> = {}): LimitContext => ({
  isAdmin: false,
  standing: 'normal',
  accountCreatedAt: new Date('2025-01-01T00:00:00Z'),
  approvedPostCount: 12,
  now: NOW,
  ...over,
});

describe('checkRateLimit — per day', () => {
  // posts: 10/day. Spread 2 h apart so the hourly cap (5) never trips.
  it('allows N-1 and blocks at N', () => {
    expect(checkRateLimit('post', times(9, 120), ctx()).ok).toBe(true);
    expect(checkRateLimit('post', times(10, 120), ctx()).ok).toBe(false);
  });

  it('ignores events older than 24 h', () => {
    expect(checkRateLimit('post', [...times(9, 120), minsAgo(24 * 60 + 1)], ctx()).ok).toBe(true);
  });

  it('retryAt is when the oldest counted event ages out, with a readable message', () => {
    const ts = times(10, 120, 10); // newest 10 min ago, oldest 10 + 18 h ago
    const r = checkRateLimit('post', ts, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok && r.code === 'TOO_MANY_REQUESTS') {
      expect(r.retryAt.toISOString()).toBe(new Date(minsAgo(10 + 18 * 60).getTime() + 24 * 3_600_000).toISOString());
      expect(r.message).toBe('You can post again in 5 h 50 m — limit is 10 posts per day.');
    }
  });
});

describe('checkRateLimit — per hour', () => {
  it('blocks at 5 posts in an hour', () => {
    expect(checkRateLimit('post', times(4, 5), ctx()).ok).toBe(true);
    const r = checkRateLimit('post', times(5, 5), ctx());
    expect(r.ok === false && r.code === 'TOO_MANY_REQUESTS' && r.message).toContain('per hour');
  });

  it('reports the later of two breached windows', () => {
    const r = checkRateLimit('newOfferPost', [minsAgo(1), minsAgo(2), minsAgo(23 * 60)], ctx());
    // day cap 3 hit (frees in ~1 h) and hour cap 2 hit (frees in 58 m) → wait for the day window
    expect(r.ok === false && r.code === 'TOO_MANY_REQUESTS' && r.message).toContain('per day');
  });

  it('applies the specific offer caps', () => {
    expect(checkRateLimit('offerPost', times(3, 5), ctx()).ok).toBe(false);
    expect(checkRateLimit('newOfferPost', times(2, 5), ctx()).ok).toBe(false);
  });

  it('topic creation has no hourly cap, 6 per day', () => {
    expect(checkRateLimit('topicCreate', times(5, 1), ctx()).ok).toBe(true);
    expect(checkRateLimit('topicCreate', times(6, 1), ctx()).ok).toBe(false);
  });
});

describe('effectiveLimits', () => {
  it('halves per-day caps for new accounts', () => {
    expect(effectiveLimits('post', ctx({ accountCreatedAt: minsAgo(60) }))).toEqual({ perHour: 5, perDay: 5 });
    expect(effectiveLimits('comment', ctx({ approvedPostCount: 0 })).perDay).toBe(50);
    expect(effectiveLimits('newOfferPost', ctx({ approvedPostCount: 0 }))).toEqual({ perHour: 2, perDay: 2 });
  });

  it('applies watch and restricted overrides to posts and comments', () => {
    expect(effectiveLimits('post', ctx({ standing: 'watch' })).perDay).toBe(3);
    expect(effectiveLimits('comment', ctx({ standing: 'watch' })).perDay).toBe(30);
    expect(effectiveLimits('offerPost', ctx({ standing: 'restricted' }))).toEqual({ perHour: 1, perDay: 1 });
    expect(effectiveLimits('comment', ctx({ standing: 'restricted' })).perDay).toBe(10);
    expect(effectiveLimits('vote', ctx({ standing: 'restricted' }))).toEqual(BOARD_LIMITS.vote);
  });

  it('takes the stricter of new-account halving and standing', () => {
    expect(effectiveLimits('post', ctx({ standing: 'watch', approvedPostCount: 0 })).perDay).toBe(3);
  });
});

describe('isNewAccount', () => {
  it('is new under 7 days or with no approved posts', () => {
    expect(isNewAccount({ accountCreatedAt: minsAgo(6 * 24 * 60), approvedPostCount: 5, now: NOW })).toBe(true);
    expect(isNewAccount({ accountCreatedAt: minsAgo(8 * 24 * 60), approvedPostCount: 0, now: NOW })).toBe(true);
    expect(isNewAccount({ accountCreatedAt: minsAgo(8 * 24 * 60), approvedPostCount: 1, now: NOW })).toBe(false);
  });
});

describe('admin + banned', () => {
  it('exempts admins', () => {
    expect(checkRateLimit('post', times(50, 1), ctx({ isAdmin: true })).ok).toBe(true);
    expect(checkCooldown('post', minsAgo(0), { isAdmin: true, now: NOW }).ok).toBe(true);
    expect(checkPerTarget('commentsPerPost', 99, { isAdmin: true, now: NOW }).ok).toBe(true);
  });

  it('forbids banned users regardless of counts', () => {
    expect(checkRateLimit('comment', [], ctx({ standing: 'banned' }))).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('checkCooldown', () => {
  it('needs 30 s between posts and 5 s between comments', () => {
    expect(checkCooldown('post', new Date(NOW.getTime() - 29_000), { isAdmin: false, now: NOW })).toMatchObject({ ok: false, message: 'Slow down — you can post again in 1 s.' });
    expect(checkCooldown('post', new Date(NOW.getTime() - 30_000), { isAdmin: false, now: NOW }).ok).toBe(true);
    expect(checkCooldown('comment', new Date(NOW.getTime() - 4_000), { isAdmin: false, now: NOW }).ok).toBe(false);
    expect(checkCooldown('comment', null, { isAdmin: false, now: NOW }).ok).toBe(true);
  });
});

describe('checkRejectLock', () => {
  it('locks writes for 24 h after the cap of rejected submissions', () => {
    expect(checkRejectLock(times(4, 1), ctx()).ok).toBe(true);
    const r = checkRejectLock(times(5, 1, 30), ctx());
    expect(r.ok).toBe(false);
    if (!r.ok && r.code === 'TOO_MANY_REQUESTS') {
      expect(r.retryAt.toISOString()).toBe(new Date(minsAgo(30).getTime() + 24 * 3_600_000).toISOString());
      expect(r.message).toContain('broke the board rules');
    }
  });
});

describe('checkPostTopics', () => {
  it('requires 1–5 topics with at most 3 new', () => {
    expect(checkPostTopics(0, 0)).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    expect(checkPostTopics(5, 3).ok).toBe(true);
    expect(checkPostTopics(6, 0)).toMatchObject({ ok: false, message: 'Pick up to 5 topics.' });
    expect(checkPostTopics(4, 4)).toMatchObject({ ok: false, message: 'Max 3 new topics per post.' });
  });
});

describe('checkPerTarget', () => {
  it.each(Object.entries(BOARD_PER_POST_LIMITS).filter(([k]) => !['newTopicsPerPost', 'topicsPerPost', 'reportsPerTarget'].includes(k)))(
    '%s caps at %i',
    (limit, cap) => {
      const l = limit as Parameters<typeof checkPerTarget>[0];
      expect(checkPerTarget(l, cap - 1, { isAdmin: false, now: NOW }).ok).toBe(true);
      expect(checkPerTarget(l, cap, { isAdmin: false, now: NOW }).ok).toBe(false);
    },
  );
});

describe('remaining', () => {
  it('counts what is left in each window', () => {
    expect(remaining('post', times(2, 120), ctx())).toEqual({ hour: 4, day: 8 });
    expect(remaining('topicCreate', [], ctx())).toEqual({ hour: null, day: 6 });
    expect(remaining('post', times(30, 1), ctx())).toEqual({ hour: 0, day: 0 });
    expect(remaining('post', [], ctx({ isAdmin: true }))).toEqual({ hour: null, day: null });
  });
});

describe('formatWait', () => {
  it('formats minutes and hours', () => {
    expect(formatWait(0)).toBe('less than a minute');
    expect(formatWait(45 * 60_000)).toBe('45 m');
    expect(formatWait(2 * 3_600_000)).toBe('2 h');
    expect(formatWait(134 * 60_000)).toBe('2 h 14 m');
  });
});
