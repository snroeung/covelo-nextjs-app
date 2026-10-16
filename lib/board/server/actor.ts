// Everything the rate limiter and moderation need to know about the caller:
// standing, account age, and what they did in the last 24 hours (plan §3.1).
// Counted from Postgres — held, removed and deleted rows included — so
// takedowns and deletions never refund quota.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LimitContext, Standing } from "@/lib/board/limits";
import { must } from "./errors";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_CAP = 1000;

export interface UserEvents {
  posts: Array<{ createdAt: Date; kind: "tip" | "offer"; newOffer: boolean; offerTable: string | null; offerId: string | null }>;
  comments: Array<{ createdAt: Date; postId: string; parentId: string | null }>;
  /** Vote writes (a changed or removed vote counts too) */
  votes: Date[];
  topics: Date[];
  reports: Date[];
  /** Submissions the pipeline rejected outright */
  rejects: Date[];
  edits: Array<{ createdAt: Date; targetId: string }>;
}

export type EventKind = keyof UserEvents;
const ALL_EVENTS: EventKind[] = ["posts", "comments", "votes", "topics", "reports", "rejects", "edits"];

const dates = (rows: Array<{ created_at?: string; updated_at?: string }> | null, col: "created_at" | "updated_at" = "created_at") =>
  (rows ?? []).map((r) => new Date((col === "updated_at" ? r.updated_at : r.created_at) as string));

export async function loadStanding(admin: SupabaseClient, userId: string): Promise<Standing> {
  const { data } = await admin.from("board_author_standing").select("standing").eq("user_id", userId).maybeSingle();
  const s = (data as { standing?: string } | null)?.standing;
  return s === "banned" || s === "restricted" || s === "watch" ? s : "normal";
}

export async function loadEvents(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  want: readonly EventKind[] = ALL_EVENTS,
): Promise<UserEvents> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const wants = new Set(want);
  const empty = Promise.resolve({ data: [] as never[], error: null });

  const [posts, comments, votes, topics, reports, rejects, edits] = await Promise.all([
    wants.has("posts")
      ? admin.from("board_posts").select("created_at, kind, member_offer_id, offer_table, offer_id").eq("author_id", userId).gte("created_at", since).limit(ROW_CAP)
      : empty,
    wants.has("comments")
      ? admin.from("board_comments").select("created_at, post_id, parent_id").eq("author_id", userId).gte("created_at", since).limit(ROW_CAP)
      : empty,
    wants.has("votes")
      ? admin.from("board_votes").select("updated_at").eq("user_id", userId).gte("updated_at", since).limit(ROW_CAP)
      : empty,
    wants.has("topics")
      ? admin.from("board_topics").select("created_at").eq("created_by", userId).gte("created_at", since).limit(ROW_CAP)
      : empty,
    wants.has("reports")
      ? admin.from("board_reports").select("created_at").eq("reporter_id", userId).gte("created_at", since).limit(ROW_CAP)
      : empty,
    wants.has("rejects")
      ? admin.from("board_mod_events").select("created_at").eq("subject_user_id", userId).eq("action", "auto_reject").gte("created_at", since).limit(ROW_CAP)
      : empty,
    wants.has("edits")
      ? admin.from("board_mod_events").select("created_at, target_id").eq("subject_user_id", userId).eq("action", "post_edit").gte("created_at", since).limit(ROW_CAP)
      : empty,
  ]);

  type PostRow = { created_at: string; kind: "tip" | "offer"; member_offer_id: string | null; offer_table: string | null; offer_id: string | null };
  type CommentRow = { created_at: string; post_id: string; parent_id: string | null };
  type EditRow = { created_at: string; target_id: string };

  return {
    posts: (must(posts, "post history") as unknown as PostRow[]).map((r) => ({
      createdAt: new Date(r.created_at), kind: r.kind, newOffer: r.member_offer_id !== null, offerTable: r.offer_table, offerId: r.offer_id,
    })),
    comments: (must(comments, "comment history") as unknown as CommentRow[]).map((r) => ({
      createdAt: new Date(r.created_at), postId: r.post_id, parentId: r.parent_id,
    })),
    votes: dates(must(votes, "vote history") as never, "updated_at"),
    topics: dates(must(topics, "topic history") as never),
    reports: dates(must(reports, "report history") as never),
    rejects: dates(must(rejects, "moderation history") as never),
    edits: (must(edits, "edit history") as unknown as EditRow[]).map((r) => ({ createdAt: new Date(r.created_at), targetId: r.target_id })),
  };
}

export interface Actor {
  userId: string;
  ctx: LimitContext;
  events: UserEvents;
}

export async function loadActor(
  admin: SupabaseClient,
  user: { id: string; created_at?: string },
  isAdmin: boolean,
  want: readonly EventKind[] = ALL_EVENTS,
  now: Date = new Date(),
): Promise<Actor> {
  const [standing, events, approved] = await Promise.all([
    loadStanding(admin, user.id),
    loadEvents(admin, user.id, now, want),
    admin
      .from("board_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .in("mod_status", ["clean", "unscanned"]),
  ]);
  return {
    userId: user.id,
    events,
    ctx: {
      isAdmin,
      standing,
      accountCreatedAt: user.created_at ? new Date(user.created_at) : now,
      approvedPostCount: approved.count ?? 0,
      now,
    },
  };
}

/** Display name for new content: profile name, then the OAuth name, then a neutral fallback. */
export async function loadDisplayName(
  admin: SupabaseClient,
  user: { id: string; user_metadata?: unknown },
): Promise<string> {
  const { data } = await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return (
    (data as { display_name: string | null } | null)?.display_name?.trim() ||
    (typeof meta.full_name === "string" ? meta.full_name.trim() : "") ||
    "Traveler"
  );
}
