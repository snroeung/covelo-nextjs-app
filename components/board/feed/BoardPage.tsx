'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeError } from '@/lib/board/errors';
import { DEFAULT_FILTERS, filtersToSearch, hasActiveFilters, parseFilters, type BoardFilters as Filters } from '@/lib/board/filters';
import { useBoardFeed, useBoardTopics, useBoardViewer } from '@/hooks/useBoard';
import { useFeedScrollRestore } from '@/hooks/useFeedScrollRestore';
import { saveFeedSearch } from '@/components/board/shared/backLink';
import { BoardFilters } from './BoardFilters';
import { BoardHeader } from './BoardHeader';
import { BoardSidebar } from './BoardSidebar';
import { BTN_GHOST } from '@/components/ui/button';
import { Composer } from '@/components/board/compose/Composer';
import { FeedSkeleton } from '@/components/board/shared/FeedSkeleton';
import { PostCard } from './PostCard';
import { SignInPrompt } from '@/components/board/shared/SignInPrompt';

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

  // Back, reload or "The board" on a post return to where the member was, loading the batches
  // that were open then. Until that is done the sentinel below stays quiet.
  const restore = useFeedScrollRestore({
    feedKey: filtersToSearch(filters),
    loaded: posts.length,
    ready: feed.data !== undefined && !feed.isPlaceholderData,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchFailed: feed.isFetchNextPageError,
    fetchNextPage: feed.fetchNextPage,
  });

  // Infinite scroll: an invisible marker under the last post. Once it comes within 600px of the
  // viewport the next batch is requested, and it keeps asking until the marker is pushed back out.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, fetchNextPage } = feed;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage || isFetchNextPageError || isPlaceholderData || restore.restoring) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
    }, { rootMargin: '600px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, restore.restoring, fetchNextPage, posts.length]);

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
            {feed.isPending || restore.restoring ? (
              <FeedSkeleton />
            ) : feed.isError && !feed.data ? (
              // Only when there is nothing to show: a failed later batch keeps the posts already loaded
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

            {hasNextPage && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

            {isFetchingNextPage && (
              <div className="mt-2.5">
                <FeedSkeleton count={2} label="Loading more posts" />
              </div>
            )}

            {isFetchNextPageError && (
              <div role="alert" className="mt-3 rounded-[10px] border border-dashed border-gph-line p-5 text-center text-[13px] text-gph-muted">
                <p className="mb-3">Couldn&rsquo;t load more posts.</p>
                <button type="button" onClick={() => void fetchNextPage()} className={BTN_GHOST}>Try again</button>
              </div>
            )}

            {!hasNextPage && posts.length > 0 && !feed.isFetching && (
              <p className="mt-5 text-center text-xs text-gph-muted">You&rsquo;re all caught up.</p>
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
