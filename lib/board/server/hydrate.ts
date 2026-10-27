// FeedRow[] → BoardPost[] and comment rows → a thread, with the viewer's own
// votes / saves and everything the card needs resolved in a few batched
// queries (one round of Promise.all, never per-post).

import type { SupabaseClient } from "@supabase/supabase-js";
import { initials, toneFor } from "@/lib/board/avatar";
import { heldMessage } from "@/lib/board/moderation/decide";
import {
  catalogSpendingOffer, catalogTransferOffer, memberOffer,
  type BoardOffer, type MemberOfferRow, type SpendingBonusFields, type TransferBonusFields,
} from "@/lib/board/offerView";
import type {
  AuthorStanding, BoardAuthor, BoardComment, BoardPost, BoardTopicRef, ModDetail, ModNotice, ModStatus, Viewer, VoteValue,
} from "@/lib/board/types";
import { commentRender, REMOVED_COMMENT_BODY } from "@/lib/board/visibility";
import type { ModFlag, ModReason } from "@/lib/board/constants";
import { must } from "./errors";
import type { FeedRow } from "./feed";

const SYSTEM_AUTHOR: BoardAuthor = { name: "covelo", initials: "CV", tone: "blue", isSystem: true };
const DELETED_AUTHOR: BoardAuthor = { name: "[deleted]", initials: "?", tone: "blue", isSystem: false };

export function authorFor(name: string): BoardAuthor {
  return { name, initials: initials(name), tone: toneFor(name), isSystem: false };
}

const none = Promise.resolve({ data: [] as never[], error: null });
const unique = <T,>(xs: Array<T | null | undefined>): T[] => [...new Set(xs.filter((x): x is T => x != null))];

function noticeFor(
  mod: { status: ModStatus; reasons: readonly string[]; removedReason: string | null },
  review: string | null,
  rejectReason: string | null,
  visibleToOwner: boolean,
): ModNotice | null {
  if (!visibleToOwner) return null;
  if (mod.status === "held") return { kind: "held", message: heldMessage(mod.reasons), reason: null };
  if (mod.status === "removed") return { kind: "removed", message: "A moderator removed this.", reason: mod.removedReason };
  if (review === "rejected") return { kind: "rejected", message: "An admin rejected this offer.", reason: rejectReason };
  return null;
}

/** Open reports against one item. */
export interface ReportTally {
  count: number;
  reasons: string[];
}
const NO_REPORTS: ReportTally = { count: 0, reasons: [] };

/** target id → open reports, for one page of posts or comments. Admin views only. */
export async function loadReportTallies(admin: SupabaseClient, kind: "post" | "comment", ids: readonly string[]): Promise<Map<string, ReportTally>> {
  const tallies = new Map<string, ReportTally>();
  if (ids.length === 0) return tallies;
  const res = await admin.from("board_reports").select("target_id, reason").eq("target_kind", kind).in("target_id", ids as string[]).is("resolved_at", null);
  for (const r of must(res, "reports") as unknown as Array<{ target_id: string; reason: string }>) {
    const t = tallies.get(r.target_id) ?? { count: 0, reasons: [] };
    t.count++;
    if (!t.reasons.includes(r.reason)) t.reasons.push(r.reason);
    tallies.set(r.target_id, t);
  }
  return tallies;
}

/** author id → standing, for one page of posts or comments. Admin views only; absent = normal. */
export async function loadAuthorStandings(admin: SupabaseClient, userIds: readonly string[]): Promise<Map<string, AuthorStanding>> {
  const out = new Map<string, AuthorStanding>();
  if (userIds.length === 0) return out;
  const res = await admin.from("board_author_standing").select("user_id, standing").in("user_id", userIds as string[]);
  for (const r of must(res, "standing") as unknown as Array<{ user_id: string; standing: string }>) {
    if (r.standing === "banned" || r.standing === "restricted" || r.standing === "watch") out.set(r.user_id, r.standing);
  }
  return out;
}

function modDetail(
  status: ModStatus, reasons: string[], flags: string[], scores: Record<string, unknown> | null, removedReason: string | null,
  viewer: Viewer, author: { id: string | null; standing?: AuthorStanding }, reports: ReportTally = NO_REPORTS,
): ModDetail | null {
  return viewer.isAdmin
    ? {
        status, reasons: reasons as ModReason[], flags: flags as ModFlag[], scores, removedReason,
        authorId: author.id, authorStanding: author.standing ?? "normal",
        reportCount: reports.count, reportReasons: reports.reasons,
      }
    : null;
}

export async function hydratePosts(admin: SupabaseClient, rows: readonly FeedRow[], viewer: Viewer): Promise<BoardPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const transferIds = unique(rows.filter((r) => r.offer_table === "transfer_bonuses").map((r) => r.offer_id));
  const spendingIds = unique(rows.filter((r) => r.offer_table === "spending_bonuses").map((r) => r.offer_id));
  const memberIds = unique(rows.map((r) => r.member_offer_id));
  const verifierIds = unique(rows.map((r) => r.verified_by));
  const topicIds = unique(rows.flatMap((r) => r.topic_ids ?? []));

  const [topics, votes, saves, transfers, spendings, members, verifiers, reportTallies, standings] = await Promise.all([
    topicIds.length ? admin.from("board_topics").select("id, name, key").in("id", topicIds) : none,
    viewer.id ? admin.from("board_votes").select("post_id, value").eq("user_id", viewer.id).in("post_id", ids) : none,
    viewer.id ? admin.from("board_saves").select("post_id").eq("user_id", viewer.id).in("post_id", ids) : none,
    transferIds.length
      ? admin.from("transfer_bonuses").select("id, issuer, transfer_partner, bonus_pct, min_transfer_points, end_date, description, source_url").in("id", transferIds)
      : none,
    spendingIds.length
      ? admin.from("spending_bonuses").select("id, issuer, merchant_name, bonus_multiplier, bonus_type, spending_minimum, minimum_nights, end_date, description, source_url").in("id", spendingIds)
      : none,
    memberIds.length ? admin.from("board_member_offers").select("*").in("id", memberIds) : none,
    verifierIds.length ? admin.from("profiles").select("id, display_name").in("id", verifierIds) : none,
    viewer.isAdmin ? loadReportTallies(admin, "post", ids) : Promise.resolve(new Map<string, ReportTally>()),
    viewer.isAdmin ? loadAuthorStandings(admin, unique(rows.map((r) => r.author_id))) : Promise.resolve(new Map<string, AuthorStanding>()),
  ]);

  const topicById = new Map((must(topics, "topics") as unknown as Array<BoardTopicRef>).map((t) => [t.id, t]));
  const voteByPost = new Map((must(votes, "votes") as unknown as Array<{ post_id: string; value: VoteValue }>).map((v) => [v.post_id, v.value]));
  const savedIds = new Set((must(saves, "saves") as unknown as Array<{ post_id: string }>).map((s) => s.post_id));
  const offerById = new Map<string, BoardOffer>();
  for (const t of must(transfers, "offers") as unknown as Array<TransferBonusFields & { id: string; source_url: string | null }>) offerById.set(`transfer_bonuses:${t.id}`, catalogTransferOffer(t));
  for (const s of must(spendings, "offers") as unknown as Array<SpendingBonusFields & { id: string; source_url: string | null }>) offerById.set(`spending_bonuses:${s.id}`, catalogSpendingOffer(s));
  for (const m of must(members, "offers") as unknown as MemberOfferRow[]) offerById.set(`member:${m.id}`, memberOffer(m));
  const verifierName = new Map((must(verifiers, "profiles") as unknown as Array<{ id: string; display_name: string | null }>).map((p) => [p.id, p.display_name?.trim() || "Admin"]));

  return rows.map((r): BoardPost => {
    const mine = viewer.id !== null && r.author_id === viewer.id;
    const offer = r.member_offer_id ? offerById.get(`member:${r.member_offer_id}`) : r.offer_id ? offerById.get(`${r.offer_table}:${r.offer_id}`) : undefined;
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      author: r.is_system ? SYSTEM_AUTHOR : authorFor(r.author_name),
      isMine: mine,
      createdAt: r.created_at,
      // Primary topic (board_posts.topic_id) first
      topics: [...(r.topic_ids ?? [])]
        .sort((a, b) => Number(b === r.topic_id) - Number(a === r.topic_id))
        .map((id) => topicById.get(id))
        .filter((t): t is BoardTopicRef => !!t),
      score: r.score,
      myVote: voteByPost.get(r.id) ?? 0,
      saved: savedIds.has(r.id),
      commentCount: r.comment_count,
      commentsLocked: r.comments_locked,
      offer: offer ?? null,
      review: r.review,
      verified: r.review === "approved" && r.verified_at
        ? { by: r.verified_by ? initials(verifierName.get(r.verified_by) ?? "Admin") : "CV", at: r.verified_at }
        : null,
      notice: noticeFor({ status: r.mod_status, reasons: r.mod_reasons, removedReason: r.removed_reason }, r.review, r.reject_reason, mine || viewer.isAdmin),
      mod: modDetail(r.mod_status, r.mod_reasons, r.mod_flags, r.mod_scores, r.removed_reason, viewer, { id: r.author_id, standing: r.author_id ? standings.get(r.author_id) : undefined }, reportTallies.get(r.id)),
    };
  });
}

/** A board_comments row, as read for a thread. */
export interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  score: number;
  created_at: string;
  deleted_at: string | null;
  mod_status: ModStatus;
  mod_reasons: string[];
  mod_flags: string[];
  mod_scores: Record<string, unknown> | null;
  removed_reason: string | null;
}

export const COMMENT_COLUMNS =
  "id, post_id, parent_id, author_id, body, score, created_at, deleted_at, mod_status, mod_reasons, mod_flags, mod_scores, removed_reason";

/** Pure: rows → a nested thread, applying visibility. Newest-first by default; the client re-sorts. */
export function buildCommentTree(
  rows: readonly CommentRow[],
  ctx: {
    viewer: Viewer; postAuthorId: string | null; names: ReadonlyMap<string, string>; votes: ReadonlyMap<string, VoteValue>;
    /** Admin views: open reports per comment */
    reports?: ReadonlyMap<string, ReportTally>;
    standings?: ReadonlyMap<string, AuthorStanding>;
  },
): BoardComment[] {
  const children = new Map<string | null, CommentRow[]>();
  for (const r of rows) {
    const list = children.get(r.parent_id) ?? [];
    list.push(r);
    children.set(r.parent_id, list);
  }

  const build = (r: CommentRow): BoardComment | null => {
    const render = commentRender(r, ctx.viewer);
    if (render === "hidden") return null; // a hidden comment takes its replies with it
    const replies = (children.get(r.id) ?? []).map(build).filter((c): c is BoardComment => c !== null);
    if (render === "deleted" && replies.length === 0) return null;

    const mine = ctx.viewer.id !== null && r.author_id === ctx.viewer.id;
    const name = ctx.names.get(r.author_id) ?? "Traveler";
    const placeholder = render === "deleted" || render === "removed";
    return {
      id: r.id,
      postId: r.post_id,
      parentId: r.parent_id,
      author: render === "deleted" ? DELETED_AUTHOR : authorFor(name),
      isMine: mine,
      isOp: ctx.postAuthorId !== null && r.author_id === ctx.postAuthorId,
      body: render === "deleted" ? "[deleted]" : render === "removed" ? REMOVED_COMMENT_BODY : r.body,
      createdAt: r.created_at,
      score: placeholder ? 0 : r.score,
      myVote: ctx.votes.get(r.id) ?? 0,
      notice: noticeFor({ status: r.mod_status, reasons: r.mod_reasons, removedReason: r.removed_reason }, null, null, mine || ctx.viewer.isAdmin),
      mod: modDetail(r.mod_status, r.mod_reasons, r.mod_flags, r.mod_scores, r.removed_reason, ctx.viewer, { id: r.author_id, standing: ctx.standings?.get(r.author_id) }, ctx.reports?.get(r.id)),
      replies,
    };
  };

  return (children.get(null) ?? []).map(build).filter((c): c is BoardComment => c !== null);
}

export async function loadThread(
  admin: SupabaseClient,
  postId: string,
  postAuthorId: string | null,
  viewer: Viewer,
): Promise<BoardComment[]> {
  const res = await admin.from("board_comments").select(COMMENT_COLUMNS).eq("post_id", postId).order("created_at", { ascending: true }).limit(1000);
  const rows = must(res, "comments") as unknown as CommentRow[];
  if (rows.length === 0) return [];

  const authorIds = unique(rows.map((r) => r.author_id));
  const [profiles, votes, reports, standings] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", authorIds),
    viewer.id ? admin.from("board_votes").select("comment_id, value").eq("user_id", viewer.id).in("comment_id", rows.map((r) => r.id)) : none,
    viewer.isAdmin ? loadReportTallies(admin, "comment", rows.map((r) => r.id)) : Promise.resolve(new Map<string, ReportTally>()),
    viewer.isAdmin ? loadAuthorStandings(admin, authorIds) : Promise.resolve(new Map<string, AuthorStanding>()),
  ]);
  const names = new Map(
    (must(profiles, "profiles") as unknown as Array<{ id: string; display_name: string | null }>).map((p) => [p.id, p.display_name?.trim() || "Traveler"]),
  );
  const voteMap = new Map((must(votes, "votes") as unknown as Array<{ comment_id: string; value: VoteValue }>).map((v) => [v.comment_id, v.value]));
  return buildCommentTree(rows, { viewer, postAuthorId, names, votes: voteMap, reports, standings });
}
