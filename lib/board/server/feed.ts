// The member feed (plan §4, §5). Visibility is applied in SQL so held,
// removed and rejected posts never leave the database for other viewers.
//
// Ranking is done here, not in SQL: hot scores decay with time, so paging a
// SQL-ordered hot feed would repeat and skip posts. Instead we pull a bounded
// candidate window, rank it in JS at the instant pinned in the cursor, and
// slice. The window is a v1 cap — the 500 newest / 500 highest-scored posts
// match any filter — which is far deeper than a page-through.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  compareForFeed, decodeCursor, encodeCursor, isAfterCursor, makeCursor, type BoardSort, type RankablePost,
} from "@/lib/board/hot";
import type { BoardPostKind } from "@/lib/board/constants";
import type { ModStatus, ReviewStatus, Viewer } from "@/lib/board/types";
import { must } from "./errors";

export const FEED_PAGE_SIZE = 20;
export const FEED_WINDOW = 500;
const MAX_QUERY_CHARS = 100;

/** A board_posts_feed row (explicit columns — never the search_tsv blob). */
export interface FeedRow {
  id: string;
  kind: BoardPostKind;
  author_id: string | null;
  is_system: boolean;
  /** Primary topic */
  topic_id: string | null;
  title: string;
  body: string;
  offer_table: "transfer_bonuses" | "spending_bonuses" | null;
  offer_id: string | null;
  member_offer_id: string | null;
  review: ReviewStatus | null;
  verified_by: string | null;
  verified_at: string | null;
  reject_reason: string | null;
  score: number;
  comment_count: number;
  comments_locked: boolean;
  created_at: string;
  deleted_at: string | null;
  mod_status: ModStatus;
  mod_reasons: string[];
  mod_flags: string[];
  mod_scores: Record<string, unknown> | null;
  removed_reason: string | null;
  author_name: string;
  topic_ids: string[];
}

export const FEED_COLUMNS =
  "id, kind, author_id, is_system, topic_id, title, body, offer_table, offer_id, member_offer_id, review, verified_by, verified_at, reject_reason, score, comment_count, comments_locked, created_at, deleted_at, mod_status, mod_reasons, mod_flags, mod_scores, removed_reason, author_name, topic_ids";

export interface FeedParams {
  type?: BoardPostKind;
  /** Topic ids to match — a chip's topic plus anything merged into it */
  topicIds?: string[];
  q?: string;
  verifiedOnly?: boolean;
  sort: BoardSort;
  cursor?: string | null;
  limit?: number;
  /**
   * Moderator view (admin.modFeed): list posts in exactly these moderation
   * states, bypassing the member visibility rules. Never set from member code.
   */
  modStatuses?: ModStatus[];
  /** Restrict to these post ids (the Mod view's Reported filter) */
  ids?: string[];
}

export interface FeedPage {
  rows: FeedRow[];
  nextCursor: string | null;
}

// Loosely typed on purpose: supabase-js builders are a generic maze and the
// filters below are applied identically to every query.
type Q = {
  is: (...a: unknown[]) => Q; eq: (...a: unknown[]) => Q; in: (...a: unknown[]) => Q; or: (...a: unknown[]) => Q;
  overlaps: (...a: unknown[]) => Q; textSearch: (...a: unknown[]) => Q;
};

/**
 * What the normal feed shows to this viewer: public posts, plus their own
 * held / removed / rejected ones. Admins get the same feed — held and removed
 * posts are the Mod view's job (admin.modFeed), off by default.
 */
export function applyVisibility<T>(query: T, viewer: Viewer): T {
  const q = query as unknown as Q;
  if (viewer.id) {
    return q.or(
      `and(mod_status.in.(clean,unscanned),or(review.is.null,review.neq.rejected)),author_id.eq.${viewer.id}`,
    ) as unknown as T;
  }
  return q.in("mod_status", ["clean", "unscanned"]).or("review.is.null,review.neq.rejected") as unknown as T;
}

function applyFilters<T>(query: T, p: FeedParams): T {
  let q = (query as unknown as Q).is("deleted_at", null);
  if (p.type) q = q.eq("kind", p.type);
  // "Verified only" is about offers; it is ignored when browsing tips
  if (p.verifiedOnly && p.type !== "tip") q = q.eq("kind", "offer").eq("review", "approved");
  if (p.topicIds && p.topicIds.length > 0) q = q.overlaps("topic_ids", p.topicIds);
  if (p.ids) q = q.in("id", p.ids);
  const text = p.q?.trim().slice(0, MAX_QUERY_CHARS);
  if (text) q = q.textSearch("search_tsv", text, { type: "websearch", config: "english" });
  return q as unknown as T;
}

export async function queryFeed(
  admin: SupabaseClient,
  viewer: Viewer,
  params: FeedParams,
  now: Date = new Date(),
): Promise<FeedPage> {
  const limit = params.limit ?? FEED_PAGE_SIZE;
  const cursor = decodeCursor(params.cursor, params.sort);
  // A cursor pins the ranking instant; page one pins it now
  const asOf = cursor ? new Date(cursor.t) : now;

  const base = () => {
    const filtered = applyFilters(admin.from("board_posts_feed").select(FEED_COLUMNS), params);
    return params.modStatuses ? (filtered as unknown as Q).in("mod_status", params.modStatuses) as unknown as typeof filtered : applyVisibility(filtered, viewer);
  };
  const newest = () => base().order("created_at", { ascending: false }).limit(FEED_WINDOW);
  const top = () => base().order("score", { ascending: false }).order("created_at", { ascending: false }).limit(FEED_WINDOW);

  const queries = params.sort === "new" ? [newest()] : params.sort === "top" ? [top()] : [newest(), top()];
  const results = await Promise.all(queries);
  const byId = new Map<string, FeedRow>();
  for (const r of results) for (const row of must(r, "feed") as unknown as FeedRow[]) byId.set(row.id, row);

  const rank = (r: FeedRow): RankablePost => ({ id: r.id, score: r.score, createdAt: new Date(r.created_at) });
  const ranked = [...byId.values()].sort((a, b) => compareForFeed(rank(a), rank(b), params.sort, asOf));
  const rest = cursor ? ranked.filter((r) => isAfterCursor(rank(r), cursor)) : ranked;

  const rows = rest.slice(0, limit);
  const more = rest.length > limit;
  return {
    rows,
    nextCursor: more && rows.length > 0 ? encodeCursor(makeCursor(rank(rows[rows.length - 1]), params.sort, asOf)) : null,
  };
}

/** Posts matching the filters, for the "All topics" chip count. */
export async function countFeed(admin: SupabaseClient, viewer: Viewer, params: FeedParams): Promise<number> {
  const res = await applyVisibility(
    applyFilters(admin.from("board_posts_feed").select("id", { count: "exact", head: true }), params),
    viewer,
  );
  must(res, "feed count");
  return res.count ?? 0;
}

/** One post by id, no visibility filter — callers check canSeePost. */
export async function fetchPost(admin: SupabaseClient, id: string): Promise<FeedRow | null> {
  const res = await admin.from("board_posts_feed").select(FEED_COLUMNS).eq("id", id).maybeSingle();
  return (must(res, "post lookup") as unknown as FeedRow | null) ?? null;
}
