'use client';

// Data layer for the board: React Query reads, plus optimistic writes for
// votes and saves (applied at once, rolled back on error, reconciled with the
// server's own numbers on success). Cache keys include the viewer, because a
// signed-in member's feed holds their own held posts and a signed-out one
// doesn't.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { useAuth } from '@/contexts/AuthContext';
import { feedInput, type BoardFilters } from '@/lib/board/filters';
import { describeError } from '@/lib/board/errors';
import {
  applyCommentVote, applyPostVote, insertComment, mapComment, patchPostInFeed, refreshAfterWrite, removePostFromFeed,
  type FeedData, type FeedPage, type PostDetailData,
} from '@/lib/board/cache';
import type { BoardComment, VoteValue } from '@/lib/board/types';
import { useBoardToast } from '@/components/board/shared/Toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export const boardKeys = {
  feedRoot: ['board', 'feed'] as const,
  feed: (viewer: string | null, f: BoardFilters) => ['board', 'feed', viewer, feedInput(f)] as const,
  post: (viewer: string | null, id: string) => ['board', 'post', viewer, id] as const,
  postRoot: ['board', 'post'] as const,
  topics: (viewer: string | null) => ['board', 'topics', viewer] as const,
  limits: (viewer: string | null) => ['board', 'limits', viewer] as const,
  saved: (viewer: string | null) => ['board', 'saved', viewer] as const,
  savedRoot: ['board', 'saved'] as const,
  offers: (q: string) => ['board', 'offers', q] as const,
};

/** Who is looking. `ready` is false until the session check finishes, so queries don't fire as "signed out" first. */
export function useBoardViewer() {
  const { user, profile, loading } = useAuth();
  const isAdmin = useIsAdmin();
  return {
    ready: !loading,
    signedIn: !!user,
    id: user?.id ?? null,
    isAdmin,
    // The name other members see on this member's posts — never their email address
    name: user ? profile?.display_name?.trim() || profile?.username || (user.user_metadata as { full_name?: string } | undefined)?.full_name || 'Traveler' : null,
  };
}

/**
 * Wrap an action that needs a member. Signed out, it explains why nothing
 * happened (with a way to sign in) instead of failing quietly.
 */
export function useRequireSignIn() {
  const viewer = useBoardViewer();
  const toast = useBoardToast();
  return (action: () => void, doing = 'do that') => {
    if (viewer.signedIn) action();
    else toast.show(`Sign in to ${doing}`, { href: { label: 'Sign in', url: '/auth' } });
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useBoardFeed(filters: BoardFilters) {
  const viewer = useBoardViewer();
  return useInfiniteQuery({
    queryKey: boardKeys.feed(viewer.id, filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<FeedPage> => trpc.board.posts.list.query({ ...feedInput(filters), cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor,
    enabled: viewer.ready,
    staleTime: 30_000,
    // Changing a filter keeps the old list on screen until the new one lands
    placeholderData: (previous) => previous,
  });
}

export function useBoardPost(id: string) {
  const viewer = useBoardViewer();
  return useQuery({
    queryKey: boardKeys.post(viewer.id, id),
    queryFn: (): Promise<PostDetailData> => trpc.board.posts.get.query({ id }),
    enabled: viewer.ready,
    staleTime: 15_000,
    retry: (count, err) => describeError(err).code !== 'NOT_FOUND' && count < 1,
  });
}

export function useBoardTopics() {
  const viewer = useBoardViewer();
  return useQuery({
    queryKey: boardKeys.topics(viewer.id),
    queryFn: () => trpc.board.topics.list.query({}),
    enabled: viewer.ready,
    staleTime: 60_000,
  });
}

/** What the composer needs before the member writes a long post. Always fresh. */
/** The signed-in member's saved posts. Off until the list is opened, and never for a signed-out visitor. */
export function useSavedPosts(enabled: boolean) {
  const viewer = useBoardViewer();
  return useQuery({
    queryKey: boardKeys.saved(viewer.id),
    queryFn: () => trpc.board.posts.saved.query(),
    enabled: enabled && viewer.signedIn,
    staleTime: 15_000,
  });
}

export function useBoardLimits(enabled: boolean) {
  const viewer = useBoardViewer();
  return useQuery({
    queryKey: boardKeys.limits(viewer.id),
    queryFn: () => trpc.board.limits.me.query(),
    enabled: enabled && viewer.signedIn,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useCatalogOffers(q: string, enabled: boolean) {
  return useQuery({
    queryKey: boardKeys.offers(q),
    queryFn: () => trpc.board.offers.search.query({ q: q || undefined }),
    enabled,
    staleTime: 60_000,
  });
}

// ─── Optimistic writes ───────────────────────────────────────────────────────

type Snapshot = Array<[QueryKey, unknown]>;

function useRollback() {
  const qc = useQueryClient();
  return {
    /** Remember every cached feed + post detail so a failed write can put them back. */
    snapshot(): Snapshot {
      return [...qc.getQueriesData({ queryKey: boardKeys.feedRoot }), ...qc.getQueriesData({ queryKey: boardKeys.postRoot })];
    },
    restore(snap: Snapshot | undefined) {
      snap?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
  };
}

function usePostPatcher() {
  const qc = useQueryClient();
  return (postId: string, fn: (p: import('@/lib/board/types').BoardPost) => import('@/lib/board/types').BoardPost) => {
    qc.setQueriesData<FeedData>({ queryKey: boardKeys.feedRoot }, (d) => patchPostInFeed(d, postId, fn));
    qc.setQueriesData<PostDetailData>({ queryKey: boardKeys.postRoot }, (d) => (d && d.post.id === postId ? { ...d, post: fn(d.post) } : d));
  };
}

export function useVotePost() {
  const qc = useQueryClient();
  const toast = useBoardToast();
  const { snapshot, restore } = useRollback();
  const patch = usePostPatcher();
  return useMutation({
    mutationFn: (v: { postId: string; value: VoteValue }) => trpc.board.posts.vote.mutate(v),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['board'] });
      const snap = snapshot();
      patch(v.postId, (p) => applyPostVote(p, v.value));
      return { snap };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.snap);
      toast.show(describeError(err).message, { tone: 'error' });
    },
    // The server's number is the truth (someone else may have voted meanwhile)
    onSuccess: (data, v) => patch(v.postId, (p) => ({ ...p, score: data.score, myVote: data.myVote })),
  });
}

export function useVoteComment(postId: string) {
  const qc = useQueryClient();
  const toast = useBoardToast();
  const { snapshot, restore } = useRollback();
  const patchComment = (commentId: string, fn: (c: BoardComment) => BoardComment) =>
    qc.setQueriesData<PostDetailData>({ queryKey: boardKeys.postRoot }, (d) =>
      d && d.post.id === postId ? { ...d, comments: mapComment(d.comments, commentId, fn) } : d);
  return useMutation({
    mutationFn: (v: { commentId: string; value: VoteValue }) => trpc.board.comments.vote.mutate(v),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: boardKeys.postRoot });
      const snap = snapshot();
      patchComment(v.commentId, (c) => applyCommentVote(c, v.value));
      return { snap };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.snap);
      toast.show(describeError(err).message, { tone: 'error' });
    },
    onSuccess: (data, v) => patchComment(v.commentId, (c) => ({ ...c, score: data.score, myVote: data.myVote })),
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  const toast = useBoardToast();
  const { snapshot, restore } = useRollback();
  const patch = usePostPatcher();
  return useMutation({
    mutationFn: (v: { postId: string; saved: boolean }) => trpc.board.posts.save.mutate(v),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['board'] });
      const snap = snapshot();
      patch(v.postId, (p) => ({ ...p, saved: v.saved }));
      return { snap };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.snap);
      toast.show(describeError(err).message, { tone: 'error' });
    },
    // Saving or unsaving changes the saved list in the board header (see refreshAfterWrite)
    onSettled: () => refreshAfterWrite(qc, boardKeys.savedRoot),
  });
}

// ─── Writes the member waits for ─────────────────────────────────────────────

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof trpc.board.posts.create.mutate>[0]) => trpc.board.posts.create.mutate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: boardKeys.feedRoot });
      void qc.invalidateQueries({ queryKey: ['board', 'topics'] });
    },
  });
}

export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { body: string; parentId?: string }) => trpc.board.comments.create.mutate({ postId, ...v }),
    onSuccess: ({ comment }) => {
      qc.setQueriesData<PostDetailData>({ queryKey: boardKeys.postRoot }, (d) =>
        d && d.post.id === postId
          ? { post: { ...d.post, commentCount: d.post.commentCount + 1 }, comments: insertComment(d.comments, comment) }
          : d);
      qc.setQueriesData<FeedData>({ queryKey: boardKeys.feedRoot }, (d) =>
        patchPostInFeed(d, postId, (p) => ({ ...p, commentCount: p.commentCount + 1 })));
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => trpc.board.posts.delete.mutate({ id: postId }),
    onSuccess: (_d, postId) => {
      qc.setQueriesData<FeedData>({ queryKey: boardKeys.feedRoot }, (d) => removePostFromFeed(d, postId));
      void qc.invalidateQueries({ queryKey: boardKeys.feedRoot });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => trpc.board.comments.delete.mutate({ id: commentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: boardKeys.postRoot });
      void qc.invalidateQueries({ queryKey: boardKeys.feedRoot });
    },
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (v: { kind: 'post' | 'comment'; id: string; reason: (typeof import('@/lib/board/constants').BOARD_REPORT_REASONS)[number]; note?: string }) =>
      trpc.board.report.mutate(v),
  });
}

// ─── Admin writes (moderators only; the server re-checks every one) ─────────

type Target = { kind: 'post' | 'comment'; id: string };
type RemoveReason = (typeof import('@/lib/board/constants').BOARD_REMOVE_REASONS)[number];
type RejectReason = (typeof import('@/lib/board/constants').BOARD_REJECT_REASONS)[number];

export type ModOp =
  | ({ op: 'takeDown'; reason: RemoveReason; note?: string } & Target)
  | ({ op: 'restore' } & Target)
  | ({ op: 'approveHeld' } & Target)
  | ({ op: 'dismissReports' } & Target)
  | { op: 'setTopic'; postId: string; topicId: string }
  | { op: 'lockComments'; postId: string; locked: boolean }
  | { op: 'verify'; postId: string }
  | { op: 'rejectOffer'; postId: string; reason: RejectReason }
  | { op: 'setStanding'; userId: string; standing: 'normal' | 'restricted' | 'banned'; note?: string }
  | { op: 'renameTopic'; id: string; name: string }
  | { op: 'mergeTopic'; sourceId: string; targetId: string }
  | { op: 'hideTopic'; id: string; hidden: boolean }
  | { op: 'promoteTopic'; id: string };

function runModOp(v: ModOp) {
  const a = trpc.board.admin;
  switch (v.op) {
    case 'takeDown': return a.takeDown.mutate({ kind: v.kind, id: v.id, reason: v.reason, note: v.note });
    case 'restore': return a.restore.mutate({ kind: v.kind, id: v.id });
    case 'approveHeld': return a.approveHeld.mutate({ kind: v.kind, id: v.id });
    case 'dismissReports': return a.dismissReports.mutate({ kind: v.kind, id: v.id });
    case 'setTopic': return a.setTopic.mutate({ postId: v.postId, topicId: v.topicId });
    case 'lockComments': return a.lockComments.mutate({ postId: v.postId, locked: v.locked });
    case 'verify': return a.approve.mutate({ postId: v.postId });
    case 'rejectOffer': return a.reject.mutate({ postId: v.postId, reason: v.reason });
    case 'setStanding': return a.setStanding.mutate({ userId: v.userId, standing: v.standing, note: v.note });
    case 'renameTopic': return a.topics.rename.mutate({ id: v.id, name: v.name });
    case 'mergeTopic': return a.topics.merge.mutate({ sourceId: v.sourceId, targetId: v.targetId });
    case 'hideTopic': return a.topics.hide.mutate({ id: v.id, hidden: v.hidden });
    case 'promoteTopic': return a.topics.promote.mutate({ id: v.id });
  }
}

/** One mutation for every moderator action; refreshes the feed, the open post and the topic chips afterwards. */
export function useModAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ModOp) => runModOp(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: boardKeys.feedRoot });
      void qc.invalidateQueries({ queryKey: boardKeys.postRoot });
      void qc.invalidateQueries({ queryKey: ['board', 'topics'] });
    },
  });
}
