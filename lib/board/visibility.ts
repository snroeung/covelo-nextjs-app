// Who may see what (plan §7, §8.6). The feed also filters in SQL
// (server/feed.ts); these rules guard single-row reads and double-check what
// SQL returned.

import type { Viewer } from "./types";

export interface PostVisibilityFields {
  author_id: string | null;
  deleted_at: string | null;
  mod_status: string;
  review: string | null;
}

export interface CommentVisibilityFields {
  author_id: string;
  deleted_at: string | null;
  mod_status: string;
}

/** Held / removed posts and rejected offers belong to their author (and admins). */
export function canSeePost(p: PostVisibilityFields, v: Viewer): boolean {
  if (p.deleted_at) return false;
  if (v.isAdmin) return true;
  const mine = v.id !== null && p.author_id === v.id;
  if (p.mod_status === "held" || p.mod_status === "removed") return mine;
  if (p.review === "rejected") return mine;
  return true;
}

/**
 * Held comments (and their replies) are visible to author + admins only.
 * Removed comments stay in the thread as a placeholder, so they are
 * "visible" here — the body is blanked when the tree is built.
 */
export function canSeeComment(c: CommentVisibilityFields, v: Viewer): boolean {
  if (c.deleted_at) return false;
  if (v.isAdmin) return true;
  if (c.mod_status === "held") return v.id !== null && c.author_id === v.id;
  return true;
}

export type CommentRender = "full" | "removed" | "deleted" | "hidden";

/**
 * How a comment appears in a thread. Removed and deleted comments stay as
 * placeholders so replies keep their context; held ones vanish for everyone
 * but their author and admins.
 */
export function commentRender(c: CommentVisibilityFields, v: Viewer): CommentRender {
  if (c.deleted_at) return "deleted";
  if (c.mod_status === "held" && !(v.isAdmin || (v.id !== null && c.author_id === v.id))) return "hidden";
  return c.mod_status === "removed" ? "removed" : "full";
}

export const REMOVED_COMMENT_BODY = "[removed by moderator]";
