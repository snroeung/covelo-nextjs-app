// Moderator actions on board content, shared by the board page's moderator
// menu (board.admin.*) and the Pending review queue (portalData.admin.approve /
// reject on board rows). Every function takes the service-role client — the
// board tables are write-denied to sessions — and records an audit event.

import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BOARD_REJECT_REASONS, BOARD_REMOVE_REASONS } from "@/lib/board/constants";
import type { ModStatus } from "@/lib/board/types";
import { logModEvent } from "./audit";
import { bustTopicsCache } from "./cache";
import { must } from "./errors";
import { fetchPost, type FeedRow } from "./feed";

export type TargetKind = "post" | "comment";
export const TARGET_TABLE = { post: "board_posts", comment: "board_comments" } as const;
export type BoardQueueTable = (typeof TARGET_TABLE)[TargetKind];

export const notFound = (what = "Post") => new TRPCError({ code: "NOT_FOUND", message: `${what} not found.` });
export const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

interface TargetRow {
  id: string;
  author_id: string | null;
  mod_status: ModStatus;
}

async function loadTarget(admin: SupabaseClient, kind: TargetKind, targetId: string): Promise<TargetRow> {
  const res = await admin.from(TARGET_TABLE[kind]).select("id, author_id, mod_status, deleted_at").eq("id", targetId).maybeSingle();
  const row = must(res, "target lookup") as unknown as (TargetRow & { deleted_at: string | null }) | null;
  if (!row || row.deleted_at) throw notFound(kind === "post" ? "Post" : "Comment");
  return row;
}

/** Acting on content settles the reports against it. */
async function resolveReports(admin: SupabaseClient, kind: TargetKind, targetId: string, adminId: string): Promise<void> {
  await admin
    .from("board_reports")
    .update({ resolved_at: new Date().toISOString(), resolved_by: adminId })
    .eq("target_kind", kind)
    .eq("target_id", targetId)
    .is("resolved_at", null);
}

// ─── Moderating a post or comment ────────────────────────────────────────────

export async function takeDown(admin: SupabaseClient, adminId: string, kind: TargetKind, targetId: string, reason: string, note?: string): Promise<void> {
  const target = await loadTarget(admin, kind, targetId);
  must(
    await admin.from(TARGET_TABLE[kind]).update({
      mod_status: "removed", removed_by: adminId, removed_at: new Date().toISOString(), removed_reason: reason, removed_note: note || null,
    }).eq("id", targetId) as never,
    "take down",
  );
  await resolveReports(admin, kind, targetId, adminId);
  await logModEvent(admin, { targetKind: kind, targetId, subjectUserId: target.author_id, actorId: adminId, action: "take_down", reasons: [reason], note });
  await bustTopicsCache();
}

export async function restore(admin: SupabaseClient, adminId: string, kind: TargetKind, targetId: string): Promise<void> {
  const target = await loadTarget(admin, kind, targetId);
  if (target.mod_status !== "removed") throw bad("Only removed content can be restored.");
  must(
    await admin.from(TARGET_TABLE[kind]).update({
      mod_status: "clean", mod_reasons: [], removed_by: null, removed_at: null, removed_reason: null, removed_note: null,
    }).eq("id", targetId) as never,
    "restore",
  );
  await logModEvent(admin, { targetKind: kind, targetId, subjectUserId: target.author_id, actorId: adminId, action: "restore" });
  await bustTopicsCache();
}

export async function approveHeld(admin: SupabaseClient, adminId: string, kind: TargetKind, targetId: string): Promise<void> {
  const target = await loadTarget(admin, kind, targetId);
  if (target.mod_status !== "held") throw bad("Only held content can be approved.");
  must(await admin.from(TARGET_TABLE[kind]).update({ mod_status: "clean", mod_reasons: [] }).eq("id", targetId) as never, "approve held");
  await resolveReports(admin, kind, targetId, adminId);
  await logModEvent(admin, { targetKind: kind, targetId, subjectUserId: target.author_id, actorId: adminId, action: "approve_held" });
  await bustTopicsCache();
}

/**
 * "These reports don't need action": settle them and leave the content up. Held
 * content is released with approveHeld, removed content is settled by the
 * takedown itself — this is for clean content that picked up reports.
 */
export async function dismissReports(admin: SupabaseClient, adminId: string, kind: TargetKind, targetId: string): Promise<void> {
  const target = await loadTarget(admin, kind, targetId);
  const open = await admin
    .from("board_reports")
    .select("id", { count: "exact", head: true })
    .eq("target_kind", kind)
    .eq("target_id", targetId)
    .is("resolved_at", null);
  must({ data: null, error: open.error }, "report lookup");
  if ((open.count ?? 0) === 0) throw bad("There are no open reports to dismiss.");
  await resolveReports(admin, kind, targetId, adminId);
  await logModEvent(admin, { targetKind: kind, targetId, subjectUserId: target.author_id, actorId: adminId, action: "dismiss_reports" });
}

// ─── Offer verification ──────────────────────────────────────────────────────

export async function loadOfferPost(admin: SupabaseClient, postId: string): Promise<FeedRow> {
  const row = await fetchPost(admin, postId);
  if (!row || row.deleted_at) throw notFound();
  if (row.kind !== "offer") throw bad("Only offer posts are verified.");
  return row;
}

/** Why a post can't be verified with a click — null when it can. */
export function notApprovable(row: FeedRow): string | null {
  if (row.kind !== "offer") return "Not an offer post.";
  if (row.member_offer_id) return "A member-created offer must be reviewed and published.";
  if (row.review !== "pending") return `Already ${row.review}.`;
  return null;
}

export async function verify(admin: SupabaseClient, adminId: string, postId: string): Promise<void> {
  must(
    await admin.from("board_posts").update({
      review: "approved", verified_by: adminId, verified_at: new Date().toISOString(), reject_reason: null,
    }).eq("id", postId) as never,
    "verify",
  );
}

export async function rejectOfferPost(admin: SupabaseClient, postId: string, reason: string): Promise<void> {
  const row = await loadOfferPost(admin, postId);
  if (row.review === "rejected") throw bad("Already rejected.");
  must(
    await admin.from("board_posts").update({
      review: "rejected", reject_reason: reason, verified_by: null, verified_at: null,
    }).eq("id", row.id) as never,
    "reject",
  );
}

// ─── Pending-review queue entry points ───────────────────────────────────────
// The queue shows two kinds of board row: offer posts waiting for a decision,
// and held content (posts and comments). Approve and reject mean the natural
// thing for each; the row's own state decides which.

/** Check `reason` against a fixed list, with a message the queue can show. */
function pickReason<const T extends readonly string[]>(list: T, reason: string | undefined, what: string): T[number] {
  if (!reason) throw bad(`Pick a reason — ${what}.`);
  if (!list.includes(reason)) throw bad(`"${reason}" isn't a ${what} reason. Choose one of: ${list.join(", ")}.`);
  return reason as T[number];
}

/** Approve: verify a linked offer · release held content. Member-created offers go through Publish. */
export async function approveBoardItem(admin: SupabaseClient, adminId: string, table: BoardQueueTable, id: string): Promise<void> {
  if (table === "board_comments") return approveHeld(admin, adminId, "comment", id);

  const row = await fetchPost(admin, id);
  if (!row || row.deleted_at) throw notFound();
  if (row.mod_status === "held") return approveHeld(admin, adminId, "post", id);
  const why = notApprovable(row);
  if (why) throw bad(why);
  await verify(admin, adminId, row.id);
}

/**
 * Reject: refuse an offer post (reason from BOARD_REJECT_REASONS, shown to the
 * author) · take held content down (reason from BOARD_REMOVE_REASONS).
 */
export async function rejectBoardItem(admin: SupabaseClient, adminId: string, table: BoardQueueTable, id: string, reason: string | undefined): Promise<void> {
  if (table === "board_comments") {
    return takeDown(admin, adminId, "comment", id, pickReason(BOARD_REMOVE_REASONS, reason, "removal"));
  }

  const row = await fetchPost(admin, id);
  if (!row || row.deleted_at) throw notFound();
  if (row.mod_status === "held") return takeDown(admin, adminId, "post", id, pickReason(BOARD_REMOVE_REASONS, reason, "removal"));
  if (row.kind !== "offer") throw bad("Only offer posts and held content can be rejected here.");
  await rejectOfferPost(admin, id, pickReason(BOARD_REJECT_REASONS, reason, "rejection"));
}
