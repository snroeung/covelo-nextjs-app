// Daily job: take down offer posts whose offer ended more than a grace period
// ago. Expired posts are already hidden from the feed, search, saved lists and
// counts (migration 034); this removes the leftovers so they stop piling up
// in the Mod view and the pending queue.
//
// It soft-deletes (deleted_at), exactly as an author deleting their own post
// does: nothing cascades away, the row can be restored by hand, and every
// existing read already treats it as gone. The grace period is the window in
// which an admin who extends an end date by mistake can still bring a post back.

import type { SupabaseClient } from "@supabase/supabase-js";
import { must } from "./errors";
import { bustTopicsCache } from "./cache";

/** Days an offer must have been over before its post is removed */
export const EXPIRED_POST_GRACE_DAYS = 7;
/** Most posts one run removes; the rest go on the next day's run */
const BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeResult {
  /** Posts removed (in a dry run, that would be) */
  posts: Array<{ id: string; title: string; offerExpiredOn: string }>;
  /** More were due than one run takes */
  truncated: boolean;
}

export async function purgeExpiredOfferPosts(
  admin: SupabaseClient,
  opts: { dry: boolean; graceDays?: number; now?: Date },
): Promise<PurgeResult> {
  const now = opts.now ?? new Date();
  const graceDays = opts.graceDays ?? EXPIRED_POST_GRACE_DAYS;
  // An offer that ended on D is gone from pages from D+1 and removed once D is older than the grace period
  const cutoff = new Date(now.getTime() - graceDays * DAY_MS).toISOString().slice(0, 10);

  const res = await admin
    .from("board_posts_feed")
    .select("id, title, offer_expires_on")
    .eq("kind", "offer")
    .is("deleted_at", null)
    .lt("offer_expires_on", cutoff)
    .order("offer_expires_on", { ascending: true })
    .limit(BATCH);
  const rows = must(res as never, "expired offer posts") as unknown as Array<{ id: string; title: string; offer_expires_on: string }>;
  const posts = rows.map((r) => ({ id: r.id, title: r.title, offerExpiredOn: r.offer_expires_on }));
  const truncated = rows.length >= BATCH;

  if (!opts.dry && posts.length > 0) {
    must(
      await admin.from("board_posts").update({ deleted_at: now.toISOString() }).in("id", posts.map((p) => p.id)).is("deleted_at", null) as never,
      "remove expired offer posts",
    );
    await bustTopicsCache();
  }
  return { posts, truncated };
}
