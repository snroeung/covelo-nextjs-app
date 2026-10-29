// Re-run the offensive-word screen over recent content after the blocklist
// changes (plan §8.3). Blocklist only — no LLM call — because a term change
// can't alter a classifier verdict. A hit holds the item for review; it is
// never removed automatically, so an admin makes that call.

import type { SupabaseClient } from "@supabase/supabase-js";
import { scanBlocklist, type BlockedTerm } from "@/lib/board/moderation/blocklist";
import type { ModReason } from "@/lib/board/constants";
import { logModEvent } from "./audit";
import { must } from "./errors";

const ROW_CAP = 1000;

export interface RescanResult {
  scannedPosts: number;
  scannedComments: number;
  held: number;
  /** More rows matched the window than one run examines */
  truncated: boolean;
}

interface Row {
  id: string;
  author_id: string | null;
  title?: string;
  body: string;
  mod_reasons: string[];
}

export async function rescanBlocklist(
  admin: SupabaseClient,
  terms: readonly BlockedTerm[],
  opts: { days: number; actorId: string | null; now?: Date },
): Promise<RescanResult> {
  const since = new Date((opts.now ?? new Date()).getTime() - opts.days * 24 * 60 * 60 * 1000).toISOString();
  const [posts, comments] = await Promise.all([
    admin.from("board_posts").select("id, author_id, title, body, mod_reasons").is("deleted_at", null).in("mod_status", ["clean", "unscanned"]).gte("created_at", since).limit(ROW_CAP),
    admin.from("board_comments").select("id, author_id, body, mod_reasons").is("deleted_at", null).in("mod_status", ["clean", "unscanned"]).gte("created_at", since).limit(ROW_CAP),
  ]);
  const postRows = must(posts, "rescan posts") as unknown as Row[];
  const commentRows = must(comments, "rescan comments") as unknown as Row[];

  let held = 0;
  const hold = async (table: "board_posts" | "board_comments", kind: "post" | "comment", row: Row) => {
    const hit = scanBlocklist(`${row.title ?? ""}\n${row.body}`, terms as BlockedTerm[]);
    if (!hit.tier) return;
    const reason: ModReason = hit.tier === "hard" ? "hard_blocklist" : "soft_blocklist";
    const reasons = [...new Set([...row.mod_reasons, reason])];
    must(await admin.from(table).update({ mod_status: "held", mod_reasons: reasons }).eq("id", row.id) as never, "rescan hold");
    await logModEvent(admin, { targetKind: kind, targetId: row.id, subjectUserId: row.author_id, actorId: opts.actorId, action: "rescan", reasons: [reason] });
    held++;
  };
  for (const row of postRows) await hold("board_posts", "post", row);
  for (const row of commentRows) await hold("board_comments", "comment", row);

  return {
    scannedPosts: postRows.length,
    scannedComments: commentRows.length,
    held,
    truncated: postRows.length === ROW_CAP || commentRows.length === ROW_CAP,
  };
}
