import { describe, it, expect } from 'vitest';
import { canSeePost, canSeeComment } from '@/lib/board/visibility';
import { initials, toneFor } from '@/lib/board/avatar';

const ME = { id: 'u-me', isAdmin: false };
const OTHER = { id: 'u-other', isAdmin: false };
const ADMIN = { id: 'u-admin', isAdmin: true };
const ANON = { id: null, isAdmin: false };

const post = (over: Record<string, unknown> = {}) => ({ author_id: 'u-me', deleted_at: null, mod_status: 'clean', review: null as string | null, ...over });
const comment = (over: Record<string, unknown> = {}) => ({ author_id: 'u-me', deleted_at: null, mod_status: 'clean', ...over });

describe('canSeePost', () => {
  it.each([ME, OTHER, ADMIN, ANON])('shows clean and unscanned posts to everyone', (v) => {
    expect(canSeePost(post(), v)).toBe(true);
    expect(canSeePost(post({ mod_status: 'unscanned' }), v)).toBe(true);
    expect(canSeePost(post({ review: 'pending' }), v)).toBe(true);
    expect(canSeePost(post({ review: 'approved' }), v)).toBe(true);
  });

  it('hides deleted posts from everyone, admins and the author included', () => {
    for (const v of [ME, ADMIN]) expect(canSeePost(post({ deleted_at: '2026-10-13' }), v)).toBe(false);
  });

  it('shows held and removed posts to the author and admins only', () => {
    for (const status of ['held', 'removed']) {
      expect(canSeePost(post({ mod_status: status }), ME)).toBe(true);
      expect(canSeePost(post({ mod_status: status }), ADMIN)).toBe(true);
      expect(canSeePost(post({ mod_status: status }), OTHER)).toBe(false);
      expect(canSeePost(post({ mod_status: status }), ANON)).toBe(false);
    }
  });

  it('shows rejected offers to the author and admins only', () => {
    expect(canSeePost(post({ review: 'rejected' }), ME)).toBe(true);
    expect(canSeePost(post({ review: 'rejected' }), ADMIN)).toBe(true);
    expect(canSeePost(post({ review: 'rejected' }), OTHER)).toBe(false);
  });

  it('system posts (no author) are never "mine"', () => {
    expect(canSeePost(post({ author_id: null, mod_status: 'held' }), ME)).toBe(false);
    expect(canSeePost(post({ author_id: null }), ANON)).toBe(true);
  });
});

describe('canSeeComment', () => {
  it('shows clean, unscanned and removed comments (removed render as a placeholder)', () => {
    for (const status of ['clean', 'unscanned', 'removed']) expect(canSeeComment(comment({ mod_status: status }), OTHER)).toBe(true);
  });

  it('hides held comments from everyone but the author and admins', () => {
    expect(canSeeComment(comment({ mod_status: 'held' }), ME)).toBe(true);
    expect(canSeeComment(comment({ mod_status: 'held' }), ADMIN)).toBe(true);
    expect(canSeeComment(comment({ mod_status: 'held' }), OTHER)).toBe(false);
    expect(canSeeComment(comment({ mod_status: 'held' }), ANON)).toBe(false);
  });

  it('hides deleted comments from everyone', () => {
    expect(canSeeComment(comment({ deleted_at: '2026-10-13' }), ADMIN)).toBe(false);
  });
});

describe('avatar', () => {
  it('derives initials from one or more words', () => {
    expect(initials('milesnerd')).toBe('MI');
    expect(initials('Nina Rivera')).toBe('NR');
    expect(initials('lounge_lyfe')).toBe('LL');
    expect(initials('  ')).toBe('?');
    expect(initials('éclair')).toBe('ÉC');
  });

  it('picks a stable tone per name, case-insensitively', () => {
    expect(toneFor('milesnerd')).toBe(toneFor('MilesNerd'));
    expect(['blue', 'warm', 'green', 'iris']).toContain(toneFor('anyone'));
  });
});
