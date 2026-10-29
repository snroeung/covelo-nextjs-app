// The covelo board post for an admin-published catalog offer (plan §6). The
// offer editor's "Post to board" toggle creates, updates or removes it.
//
// Title and body are used exactly as stored on the offer row: the portal-sync
// cron fills them in, an admin may edit them, and nothing regenerates them.
// One system post per offer (unique index, 025). Turning the toggle off only
// soft-deletes it, so turning it back on revives the same post with its votes
// and comments.
//
// Saving an offer refreshes the post's content and nothing else. Moderation is
// an admin's decision (a take-down or hold) and the purge job's (an expired
// offer), and a later save must not undo either: only `restore`/`approveHeld`
// bring moderated content back, and a post for an offer that has ended stays
// hidden.

import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { topicKey } from "@/lib/board/topics";
import { todayIso } from "@/lib/offers/live";
import { must } from "./errors";
import { bustTopicsCache } from "./cache";
import { followMerge, loadTopicIndex, setPrimaryTopic } from "./topics";

export type OfferTable = "transfer_bonuses" | "spending_bonuses";

/** The board-related columns of a catalog offer row. */
export interface OfferBoardFields {
  post_to_board: boolean;
  board_topic: string | null;
  board_post_title: string | null;
  board_post_body: string | null;
  /** The offer's last day, "YYYY-MM-DD"; null/absent = ongoing. A post is only revived while the offer is live somewhere. */
  end_date?: string | null;
}

export type SystemPostResult = "posted" | "updated" | "hidden" | "none";

const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

/** Checks that need no database — run these before saving the offer, so a bad toggle never half-saves. */
export function assertBoardPostReady(f: Pick<OfferBoardFields, "board_post_title" | "board_topic">): void {
  if (!f.board_post_title?.trim()) throw bad("Add a board post title before posting to the board.");
  if (!f.board_topic?.trim()) throw bad("Pick a board topic before posting to the board.");
}

export async function syncSystemPost(
  admin: SupabaseClient,
  table: OfferTable,
  offerId: string,
  fields: OfferBoardFields,
  /** The admin who saved the offer. A scheduled backfill has none: the post then shows covelo's own verified mark. */
  adminUserId: string | null,
): Promise<SystemPostResult> {
  const found = await admin
    .from("board_posts")
    .select("id, deleted_at, verified_at")
    .eq("is_system", true)
    .eq("offer_table", table)
    .eq("offer_id", offerId)
    .order("created_at", { ascending: false })
    .limit(1);
  const existing = (must(found, "system post lookup") as unknown as Array<{ id: string; deleted_at: string | null; verified_at: string | null }>)[0];

  if (!fields.post_to_board) {
    if (!existing || existing.deleted_at) return "none";
    must(await admin.from("board_posts").update({ deleted_at: new Date().toISOString() }).eq("id", existing.id) as never, "system post hide");
    await bustTopicsCache();
    return "hidden";
  }

  assertBoardPostReady(fields);
  const index = await loadTopicIndex(admin);
  const wanted = index.topics.find((t) => t.key === topicKey(fields.board_topic!));
  const topic = wanted ? followMerge(index, wanted) : null;
  if (!topic) throw bad(`Unknown board topic "${fields.board_topic}".`);

  const now = new Date();
  const created = {
    review: "approved",
    verified_by: adminUserId,
    verified_at: now.toISOString(),
    reject_reason: null,
    mod_status: "clean",
    mod_reasons: [],
    deleted_at: null,
  };
  const content = {
    title: fields.board_post_title!.trim(),
    body: (fields.board_post_body ?? "").trim(),
    search_extra: `covelo ${topic.name}`,
    topic_id: topic.id,
  };

  if (existing) {
    // Content only. Revive a hidden post when the offer is live somewhere (the earliest "today" on Earth is UTC-12's);
    // an ended offer's purged post stays purged. Moderation and the first verification are never touched.
    const live = !fields.end_date || fields.end_date.slice(0, 10) >= todayIso(new Date(now.getTime() - 12 * 3_600_000));
    const revive = existing.deleted_at && live ? { deleted_at: null } : {};
    const verify = existing.verified_at ? {} : { verified_by: adminUserId, verified_at: now.toISOString() };
    must(await admin.from("board_posts").update({ ...content, ...revive, ...verify }).eq("id", existing.id) as never, "system post update");
    await setPrimaryTopic(admin, existing.id, topic.id, "demote");
    await bustTopicsCache();
    return "updated";
  }

  const inserted = await admin
    .from("board_posts")
    .insert({ ...content, ...created, kind: "offer", author_id: null, is_system: true, offer_table: table, offer_id: offerId })
    .select("id")
    .single();
  const postId = (must(inserted, "system post create") as unknown as { id: string }).id;

  const link = await admin.from("board_post_topics").insert({ post_id: postId, topic_id: topic.id, is_primary: true, created_new: false });
  if (link.error) {
    await admin.from("board_posts").delete().eq("id", postId);
    must({ data: null, error: link.error }, "system post topic");
  }
  await bustTopicsCache();
  return "posted";
}
