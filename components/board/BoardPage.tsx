'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { describeError } from '@/lib/board/errors';
import { DEFAULT_FILTERS, filtersToSearch, hasActiveFilters, parseFilters, type BoardFilters as Filters } from '@/lib/board/filters';
import { useBoardFeed, useBoardTopics, useBoardViewer } from '@/hooks/useBoard';
import { saveFeedSearch } from './backLink';
import { BoardFilters } from './BoardFilters';
import { BoardHeader } from './BoardHeader';
import { BoardSidebar } from './BoardSidebar';
import { BTN_GHOST } from '@/components/ui/button';
import { Composer } from './Composer';
import { FeedSkeleton } from './FeedSkeleton';
import { PostCard } from './PostCard';
import { SignInPrompt } from './SignInPrompt';

export function BoardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const viewer = useBoardViewer();

  // The URL is the filter state: shareable, and back/forward just work
  const filters = useMemo(() => parseFilters(params), [params]);
  const setFilters = useCallback(
    (patch: Partial<Filters>) => router.replace(`${pathname}${filtersToSearch({ ...filters, ...patch })}`, { scroll: false }),
    [router, pathname, filters],
  );

  // So a post's "The board" link returns to this exact view
  useEffect(() => saveFeedSearch(filtersToSearch(filters)), [filters]);

  const feed = useBoardFeed(filters);
  const topics = useBoardTopics();
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];
  const counts = feed.data?.pages[0]?.counts ?? null;

  const [composing, setComposing] = useState(() => params.get('compose') === '1');
  const [signInPrompt, setSignInPrompt] = useState(false);
  const newPost = () => (viewer.signedIn ? setComposing(true) : setSignInPrompt(true));

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-7 md:px-6">
      <BoardHeader onNewPost={newPost} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0">
          <BoardFilters
            filters={filters}
            onChange={setFilters}
            onClear={() => router.replace(`${pathname}${filtersToSearch({ ...DEFAULT_FILTERS, sort: filters.sort })}`, { scroll: false })}
            topics={topics.data ?? []}
            counts={counts}
          />

          <section aria-label="Posts" aria-busy={feed.isFetching}>
            {feed.isPending ? (
              <FeedSkeleton />
            ) : feed.isError ? (
              <div role="alert" className="rounded-[10px] border border-dashed border-gph-line p-7 text-center text-[13px] text-gph-muted">
                <p className="mb-3">{describeError(feed.error).message}</p>
                <button type="button" onClick={() => feed.refetch()} className={BTN_GHOST}>Try again</button>
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-gph-line p-7 text-center text-[13px] text-gph-muted">
                {filters.q.trim()
                  ? <>No posts match &ldquo;{filters.q.trim()}&rdquo;.</>
                  : hasActiveFilters(filters)
                    ? 'Nothing matches these filters.'
                    : 'Nothing here yet — be the first to post.'}
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {posts.map((post) => (
                  <li key={post.id}><PostCard post={post} /></li>
                ))}
              </ul>
            )}

            {feed.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <button type="button" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage} className={BTN_GHOST}>
                  {feed.isFetchingNextPage ? 'Loading…' : 'Load more posts'}
                </button>
              </div>
            )}
          </section>
        </div>

        <BoardSidebar />
      </div>

      {composing && <Composer onClose={() => setComposing(false)} />}
      {signInPrompt && <SignInPrompt onClose={() => setSignInPrompt(false)} />}
    </div>
  );
}
