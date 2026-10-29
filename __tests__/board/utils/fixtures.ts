// Shared row fixtures for the board router tests.

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const ME = uuid(1), OTHER = uuid(2), ADMIN = uuid(3);
export const T_TRANSFER = uuid(100), T_HOTEL = uuid(101), T_AWARD = uuid(102), T_CREDIT = uuid(103), T_NEW = uuid(104);
export const P1 = uuid(200), C1 = uuid(300), C2 = uuid(301), OFFER1 = uuid(400), MO1 = uuid(500);

export const topic = (id: string, name: string, key: string, over: Record<string, unknown> = {}) =>
  ({ id, name, key, status: 'common', merged_into_id: null, ...over });

export const TOPICS = [
  topic(T_TRANSFER, 'Transfer bonuses', 'transfer bonus'),
  topic(T_HOTEL, 'Hotels', 'hotel'),
  topic(T_AWARD, 'Award flights', 'award flight'),
  topic(T_CREDIT, 'Statement credits', 'statement credit'),
];

export const NOW = Date.now();
export const MIN = 60_000, HOUR = 3_600_000;
export const ago = (ms: number) => new Date(NOW - ms).toISOString();

export function feedRow(over: Record<string, unknown> = {}) {
  return {
    id: P1, kind: 'tip', author_id: OTHER, is_system: false, topic_id: T_HOTEL, title: 'Hyatt tip', body: 'body',
    offer_table: null, offer_id: null, member_offer_id: null, review: null, verified_by: null, verified_at: null,
    reject_reason: null, score: 3, comment_count: 0, comments_locked: false, created_at: ago(2 * HOUR), deleted_at: null,
    mod_status: 'clean', mod_reasons: [], mod_flags: [], mod_scores: null, removed_reason: null, author_name: 'pointsplease',
    topic_ids: [T_HOTEL], ...over,
  };
}

export function commentRow(over: Record<string, unknown> = {}) {
  return {
    id: C1, post_id: P1, parent_id: null, author_id: OTHER, body: 'nice', score: 1, created_at: ago(HOUR), deleted_at: null,
    mod_status: 'clean', mod_reasons: [], mod_flags: [], mod_scores: null, removed_reason: null, ...over,
  };
}
