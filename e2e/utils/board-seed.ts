import { getSupabaseAdmin } from '../../lib/supabase/admin';

// Service-role seeding for board e2e specs. Everything created carries the
// "[ZZ-E2E]" prefix and is removed by the returned cleanup, so a failed run
// can be swept with `cleanupSeededBoardData()`.

export const SEED_PREFIX = '[ZZ-E2E]';

export interface SeededMemberOffer {
  postId: string;
  memberOfferId: string;
  title: string;
  /** Topic ids the post was created with, primary first */
  topicIds: string[];
  topicNames: string[];
  cleanup: () => Promise<void>;
}

/** A member-created transfer-bonus offer post, pending review, by the seeded local member. */
export async function seedMemberOfferPost(opts: { title?: string; body?: string; topicCount?: number; endDate?: string } = {}): Promise<SeededMemberOffer> {
  const db = getSupabaseAdmin();
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const member = users?.users.find((u) => u.email === (process.env.PLAYWRIGHT_MEMBER_EMAIL || 'member@covelo.local'));
  if (!member) throw new Error('Run `npm run seed:local-member` first: the local member user is missing.');

  const { data: topics, error: topicError } = await db.from('board_topics').select('id, name').in('status', ['common', 'active']).order('name').limit(opts.topicCount ?? 2);
  if (topicError || !topics || topics.length === 0) throw new Error('No visible board topics to attach the seeded post to.');

  // Unique per seed: specs run in parallel, so each finds and removes only its own rows
  const title = opts.title ?? `${SEED_PREFIX} Bilt → AAdvantage 30% ${Math.random().toString(36).slice(2, 8)}`;
  const details = {
    kind: 'transfer', issuer: 'bilt', transfer_partner: 'American AAdvantage', bonus_pct: 30, card_ids: [], tags: [],
    start_date: '2026-01-01', end_date: opts.endDate ?? '2099-12-31', country: 'US', is_targeted: false, for_status_transfer: false,
    description: 'Seeded by e2e', source_url: 'https://example.com/promo',
  };
  const mo = await db.from('board_member_offers').insert({
    type: 'TRANSFER BONUS', value: '+30%', name: `${SEED_PREFIX} 30% transfer bonus · Bilt → American AAdvantage`, from_program: 'Bilt',
    to_program: 'American AAdvantage', conditions: '1,000 pts → 1,300 pts', ends_label: 'Dec 31', source_url: 'https://example.com/promo', details,
  }).select('id').single();
  if (mo.error) throw new Error(`seed member offer: ${mo.error.message}`);

  const post = await db.from('board_posts').insert({
    kind: 'offer', author_id: member.id, topic_id: topics[0].id, title, body: opts.body ?? 'Seeded post body', member_offer_id: mo.data.id, review: 'pending',
  }).select('id').single();
  if (post.error) {
    await db.from('board_member_offers').delete().eq('id', mo.data.id);
    throw new Error(`seed post: ${post.error.message}`);
  }
  const links = await db.from('board_post_topics').upsert(
    topics.map((t, i) => ({ post_id: post.data.id, topic_id: t.id, is_primary: i === 0 })),
    { onConflict: 'post_id,topic_id' },
  );
  if (links.error) throw new Error(`seed post topics: ${links.error.message}`);

  return {
    postId: post.data.id,
    memberOfferId: mo.data.id,
    title,
    topicIds: topics.map((t) => t.id),
    topicNames: topics.map((t) => t.name),
    cleanup: () => cleanupSeededPost(post.data.id, mo.data.id),
  };
}

/** Remove one seeded post, its member offer, and the catalog offer a publish created from it. */
export async function cleanupSeededPost(postId: string, memberOfferId: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: post } = await db.from('board_posts').select('offer_table, offer_id').eq('id', postId).maybeSingle();
  await db.from('board_posts').delete().eq('id', postId);
  if (post?.offer_table && post.offer_id) await db.from(post.offer_table).delete().eq('id', post.offer_id);
  const { data: mo } = await db.from('board_member_offers').select('published_table, published_id').eq('id', memberOfferId).maybeSingle();
  if (mo?.published_table && mo.published_id) await db.from(mo.published_table).delete().eq('id', mo.published_id);
  await db.from('board_member_offers').delete().eq('id', memberOfferId);
}

/** Move a seeded offer's end date (e.g. into the past, to expire its post). */
export async function setSeededOfferEnd(memberOfferId: string, endDate: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('board_member_offers').select('details').eq('id', memberOfferId).single();
  await db.from('board_member_offers').update({ details: { ...(data?.details as object), end_date: endDate } }).eq('id', memberOfferId);
}

/** What the database now says about a seeded post. */
export async function readSeededPost(postId: string) {
  const db = getSupabaseAdmin();
  const post = await db.from('board_posts').select('title, body, review, verified_by, offer_table, offer_id, member_offer_id, topic_id').eq('id', postId).single();
  const topics = await db.from('board_post_topics').select('topic_id, is_primary').eq('post_id', postId);
  return { post: post.data, topics: topics.data ?? [] };
}

/** Sweep every seeded row, including the catalog offers a publish created. For clearing a crashed run by hand: never call it from a spec, they run in parallel. */
export async function cleanupSeededBoardData(): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: offers } = await db.from('board_member_offers').select('id, published_table, published_id').like('name', `${SEED_PREFIX}%`);
  const { data: posts } = await db.from('board_posts').select('id, offer_table, offer_id').like('title', `${SEED_PREFIX}%`);
  for (const p of posts ?? []) {
    await db.from('board_posts').delete().eq('id', p.id);
    if (p.offer_table && p.offer_id) await db.from(p.offer_table).delete().eq('id', p.offer_id);
  }
  for (const o of offers ?? []) {
    if (o.published_table && o.published_id) await db.from(o.published_table).delete().eq('id', o.published_id);
    await db.from('board_member_offers').delete().eq('id', o.id);
  }
}
