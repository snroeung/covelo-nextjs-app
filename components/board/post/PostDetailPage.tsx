'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { describeError } from '@/lib/board/errors';
import { useBoardPost } from '@/hooks/useBoard';
import { readFeedSearch } from '@/components/board/shared/backLink';
import { BTN_GHOST } from '@/components/ui/button';
import { FeedSkeleton } from '@/components/board/shared/FeedSkeleton';
import { BoardIcon } from '@/components/board/shared/icons';
import { PostDetail } from './PostDetail';

export function PostDetailPage({ id }: { id: string }) {
  const post = useBoardPost(id);
  // sessionStorage only exists in the browser: '' while rendering on the server, the saved filters after hydration
  const backSearch = useSyncExternalStore(() => () => {}, readFeedSearch, () => '');

  const error = post.isError ? describeError(post.error) : null;

  return (
    <div className="mx-auto max-w-[820px] px-4 pb-16 pt-7 md:px-6">
      <Link
        href={`/discover/board${backSearch}`}
        className="mb-3.5 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-gph-line bg-gph-card px-3.5 text-xs font-bold text-gph-ink hover:bg-gph-linesoft focus-visible:outline-2 focus-visible:outline-gph-ink"
      >
        <BoardIcon name="chev-l" size={12} />
        The board
      </Link>

      {post.isPending ? (
        <FeedSkeleton count={1} />
      ) : post.isError ? (
        <div role="alert" className="rounded-[10px] border border-dashed border-gph-line p-8 text-center">
          <h1 className="mb-1.5 text-lg font-extrabold text-gph-ink">
            {error?.code === 'NOT_FOUND' ? "This post isn't available" : "Couldn't load this post"}
          </h1>
          <p className="mb-4 text-[13px] text-gph-muted">
            {error?.code === 'NOT_FOUND' ? 'It may have been removed, or the link is wrong.' : error?.message}
          </p>
          {error?.code === 'NOT_FOUND' ? (
            <Link href="/discover/board" className={BTN_GHOST}>Back to the board</Link>
          ) : (
            <button type="button" onClick={() => post.refetch()} className={BTN_GHOST}>Try again</button>
          )}
        </div>
      ) : (
        <PostDetail data={post.data} />
      )}
    </div>
  );
}
