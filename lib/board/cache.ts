// Optimistic updates for the board's React Query caches. Pure functions over
// the cached shapes, so the vote / save / comment arithmetic is testable and
// the hooks stay thin.

import type { InfiniteData } from "@tanstack/react-query";
import type { BoardComment, BoardPost, VoteValue } from "./types";

export interface FeedPage {
  posts: BoardPost[];
  nextCursor: string | null;
  counts: { all: number; byTopic: Record<string, number> } | null;
}
export type FeedData = InfiniteData<FeedPage>;

export interface PostDetailData {
  post: BoardPost;
  comments: BoardComment[];
}

// ─── Votes ───────────────────────────────────────────────────────────────────

/** The score if the viewer's vote moves from `current` to `next` (the score includes their own vote). */
export const scoreAfterVote = (score: number, current: VoteValue, next: VoteValue): number => score - current + next;

export function applyPostVote(post: BoardPost, value: VoteValue): BoardPost {
  return { ...post, score: scoreAfterVote(post.score, post.myVote, value), myVote: value };
}

export function applyCommentVote(comment: BoardComment, value: VoteValue): BoardComment {
  return { ...comment, score: scoreAfterVote(comment.score, comment.myVote, value), myVote: value };
}

/** Clicking the vote you already cast clears it. */
export const toggleVote = (current: VoteValue, clicked: 1 | -1): VoteValue => (current === clicked ? 0 : clicked);

// ─── Feed pages ──────────────────────────────────────────────────────────────

export function patchPostInFeed(data: FeedData | undefined, postId: string, fn: (p: BoardPost) => BoardPost): FeedData | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.id === postId ? fn(p) : p)) })) };
}

export function removePostFromFeed(data: FeedData | undefined, postId: string): FeedData | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((pg) => ({ ...pg, posts: pg.posts.filter((p) => p.id !== postId) })) };
}

// ─── Comment trees ───────────────────────────────────────────────────────────

export function mapComment(list: BoardComment[], id: string, fn: (c: BoardComment) => BoardComment): BoardComment[] {
  return list.map((c) => (c.id === id ? fn(c) : { ...c, replies: mapComment(c.replies, id, fn) }));
}

/** New root comments go first; a reply goes at the end of its parent's replies. */
export function insertComment(list: BoardComment[], comment: BoardComment): BoardComment[] {
  if (!comment.parentId) return [comment, ...list];
  return mapComment(list, comment.parentId, (parent) => ({ ...parent, replies: [...parent.replies, comment] }));
}

export function countComments(list: readonly BoardComment[]): number {
  return list.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

export type CommentSort = "top" | "new";

/** Sort a whole thread, replies included, without mutating it. */
export function sortThread(list: readonly BoardComment[], sort: CommentSort): BoardComment[] {
  const by = (a: BoardComment, b: BoardComment) =>
    sort === "top" ? b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return [...list].sort(by).map((c) => ({ ...c, replies: sortThread(c.replies, sort) }));
}

export function patchDetail(data: PostDetailData | undefined, fn: (d: PostDetailData) => PostDetailData): PostDetailData | undefined {
  return data ? fn(data) : data;
}

export { refreshAfterWrite } from "../refreshAfterWrite";
