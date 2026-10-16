// Feed ranking + cursor pagination (plan §4). hotScore mirrors the
// hot_score column in the board_posts_feed view (026) — keep them in step.

import { z } from "zod";

export type BoardSort = "hot" | "new" | "top";

const HOUR_MS = 60 * 60 * 1000;
export const HOT_GRAVITY = 1.4;
export const HOT_OFFSET_HOURS = 2;

/** score / (age_hours + 2)^1.4 */
export function hotScore(score: number, createdAt: Date, now: Date = new Date()): number {
  const ageHours = Math.max(0, (now.getTime() - createdAt.getTime()) / HOUR_MS);
  return score / Math.pow(ageHours + HOT_OFFSET_HOURS, HOT_GRAVITY);
}

export interface RankablePost {
  id: string;
  score: number;
  createdAt: Date;
}

/** Sort key for one post. Bigger = earlier in the feed for every sort. */
export function sortKey(post: RankablePost, sort: BoardSort, now: Date = new Date()): number {
  if (sort === "new") return post.createdAt.getTime();
  if (sort === "top") return post.score;
  return hotScore(post.score, post.createdAt, now);
}

/** Descending by sort key, ties broken by id descending — a total order, so cursors are stable. */
export function compareForFeed(a: RankablePost, b: RankablePost, sort: BoardSort, now: Date = new Date()): number {
  const d = sortKey(b, sort, now) - sortKey(a, sort, now);
  if (d !== 0) return d;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

const cursorSchema = z.object({ s: z.enum(["hot", "new", "top"]), k: z.number().finite(), id: z.guid() });
export type FeedCursor = z.infer<typeof cursorSchema>;

// Cursor JSON is ASCII-only (uuid, numbers, sort name), so btoa/atob are safe —
// and unlike Buffer they work in the browser too.
export function encodeCursor(c: FeedCursor): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Null on anything malformed or from a different sort — the caller restarts at page one. */
export function decodeCursor(raw: string | null | undefined, sort: BoardSort): FeedCursor | null {
  if (!raw) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))));
    return parsed.success && parsed.data.s === sort ? parsed.data : null;
  } catch {
    return null;
  }
}

/** True when `post` comes strictly after the cursor position. */
export function isAfterCursor(post: RankablePost, cursor: FeedCursor, now: Date = new Date()): boolean {
  const k = sortKey(post, cursor.s, now);
  return k < cursor.k || (k === cursor.k && post.id < cursor.id);
}
