'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { describeError } from '@/lib/board/errors';
import { timeAgo } from '@/lib/board/format';
import type { BoardPost } from '@/lib/board/types';
import { boardKeys, useBoardViewer, useRequireSignIn, useSavePost, useSavedPosts } from '@/hooks/useBoard';
import { btn } from '@/components/ui/button';
import { SavedPopover } from '@/components/ui/SavedPopover';
import { BoardIcon } from '@/components/board/shared/icons';
import { postPath } from '@/components/board/shared/share';
import { VerifyBadge } from '@/components/board/post/Badges';

/**
 * "Saved posts" beside "New post": opens a list of everything the member has
 * saved. A tap or click toggles it (no hover-only behaviour), Escape / an
 * outside click / following a link closes it. On a phone it's a bottom sheet.
 * Saving needs an account, so for a signed-out visitor the button explains that
 * instead of opening an empty list.
 */
export function SavedPostsMenu() {
  const requireSignIn = useRequireSignIn();
  return (
    <SavedPopover
      label="Saved posts"
      icon={(open) => <BoardIcon name="save" size={13} filled={open} />}
      beforeOpen={(open) => requireSignIn(open, 'see your saved posts')}
    >
      {(close) => <SavedList onNavigate={close} />}
    </SavedPopover>
  );
}

function SavedList({ onNavigate }: { onNavigate: () => void }) {
  const viewer = useBoardViewer();
  const saved = useSavedPosts(true);
  const qc = useQueryClient();
  const unsave = useSavePost();

  if (saved.isPending) {
    return (
      <ul aria-busy="true" aria-label="Loading saved posts" className="flex flex-col gap-1 px-1 pb-1">
        {[0, 1, 2].map((i) => <li key={i} className="h-14 animate-pulse rounded-lg bg-gph-linesoft" />)}
      </ul>
    );
  }
  if (saved.isError) {
    return (
      <div role="alert" className="px-3 py-5 text-center text-[13px] text-gph-muted">
        <p className="mb-2">{describeError(saved.error).message}</p>
        <button type="button" onClick={() => saved.refetch()} className={btn('secondary')}>Try again</button>
      </div>
    );
  }
  const posts = saved.data ?? [];
  if (posts.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[13px] leading-relaxed text-gph-muted">
        Nothing saved yet. Tap <b className="text-gph-ink">Save</b> on a post to keep it here.
      </p>
    );
  }

  function remove(post: BoardPost) {
    // Gone from the list at once; the mutation puts it back if it fails
    qc.setQueryData<BoardPost[]>(boardKeys.saved(viewer.id), (d) => d?.filter((p) => p.id !== post.id));
    unsave.mutate({ postId: post.id, saved: false });
  }

  return (
    <ul className="flex flex-col">
      {posts.map((post) => (
        <li key={post.id} className="flex items-stretch gap-1 rounded-lg hover:bg-gph-linesoft">
          <Link href={postPath(post.id)} onClick={onNavigate} className="min-w-0 flex-1 rounded-lg px-2.5 py-2 focus-visible:outline-2 focus-visible:outline-gph-ink">
            <span className="line-clamp-2 text-[13.5px] font-bold leading-snug text-gph-ink">{post.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <VerifyBadge post={post} />
              <span className="font-mono text-[10.5px] font-semibold text-gph-muted">
                {[post.author.name, timeAgo(post.createdAt), post.topics[0]?.name].filter(Boolean).join(' · ')}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => remove(post)}
            aria-label={`Remove “${post.title}” from saved`}
            className={btn('quiet', 'icon', 'shrink-0')}
          >
            <BoardIcon name="save" size={14} filled />
          </button>
        </li>
      ))}
    </ul>
  );
}
