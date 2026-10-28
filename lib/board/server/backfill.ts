// One-off (and safe to repeat): give every live offer that is switched on for
// the board a covelo post, when it has none. The portal sync leaves
// post_to_board off and the offer editor creates posts as it saves, so this
// only catches offers switched on before the board shipped.
//
// It never touches an offer that already has a visible post (an admin may have
// edited it), and never posts an ended, inactive or unapproved offer.

import type { SupabaseClient } from "@supabase/supabase-js";
import { liveOfferFilter } from "@/lib/offers/live";
import { must } from "./errors";
import { assertBoardPostReady, syncSystemPost, type OfferTable } from "./systemPost";

export type SkipReason = "already posted" | "missing title or topic";

export interface BackfillResult {
  /** Offers that got a post (or, in a dry run, would) */
  posted: Array<{ table: OfferTable; id: string; title: string }>;
  skipped: Array<{ table: OfferTable; id: string; reason: SkipReason }>;
  /** Offers whose post could not be made, with why (e.g. an unknown topic) */
  failed: Array<{ table: OfferTable; id: string; error: string }>;
}

interface OfferRow {
  id: string;
  post_to_board: boolean;
  board_topic: string | null;
  board_post_title: string | null;
  board_post_body: string | null;
}

const TABLES: OfferTable[] = ["transfer_bonuses", "spending_bonuses"];
const ROW_CAP = 1000;

export async function backfillSystemPosts(admin: SupabaseClient, opts: { dry: boolean; now?: Date }): Promise<BackfillResult> {
  const out: BackfillResult = { posted: [], skipped: [], failed: [] };

  for (const table of TABLES) {
    const res = await admin
      .from(table)
      .select("id, post_to_board, board_topic, board_post_title, board_post_body")
      .eq("post_to_board", true)
      .eq("active", true)
      .in("status", ["admin", "approved"])
      .or(liveOfferFilter(opts.now))
      .limit(ROW_CAP);
    const offers = must(res as never, `${table} to backfill`) as unknown as OfferRow[];
    if (offers.length === 0) continue;

    const postsRes = await admin
      .from("board_posts")
      .select("offer_id, deleted_at")
      .eq("is_system", true)
      .eq("offer_table", table)
      .in("offer_id", offers.map((o) => o.id));
    const visible = new Set(
      (must(postsRes as never, "system posts") as unknown as Array<{ offer_id: string; deleted_at: string | null }>)
        .filter((p) => !p.deleted_at)
        .map((p) => p.offer_id),
    );

    for (const offer of offers) {
      const ref = { table, id: offer.id };
      if (visible.has(offer.id)) { out.skipped.push({ ...ref, reason: "already posted" }); continue; }
      try { assertBoardPostReady(offer); } catch { out.skipped.push({ ...ref, reason: "missing title or topic" }); continue; }

      if (opts.dry) { out.posted.push({ ...ref, title: offer.board_post_title!.trim() }); continue; }
      try {
        await syncSystemPost(admin, table, offer.id, offer, null);
        out.posted.push({ ...ref, title: offer.board_post_title!.trim() });
      } catch (err) {
        out.failed.push({ ...ref, error: err instanceof Error ? err.message : "failed" });
      }
    }
  }
  return out;
}
