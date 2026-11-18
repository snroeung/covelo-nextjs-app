'use client';

// Puts the board feed back where the member left it. The position is saved whenever the feed is
// left (another page, a filter change, a reload or tab close) and used when the feed opens again by
// Back/Forward, a reload, or the "The board" link on a post. A plain visit (nav bar, typed URL)
// still opens at the top. If fewer posts are loaded now than then, the missing batches are
// fetched first: there is nothing to scroll to until they exist.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clearFeedReturn, peekFeedReturn, readFeedPosition, saveFeedPosition, type FeedPosition,
} from '@/lib/board/feedPosition';

/** A history step (Back/Forward) is followed by the feed mounting a moment later. */
const TRAVERSAL_WINDOW_MS = 5000;

// popstate fires for Back/Forward before the feed renders; a document load by Back/Forward or
// reload is read once from the navigation entry. Module-level on purpose: they happen before any
// component exists to hear them.
let lastTraversalAt = 0;
let bootedByHistory = false;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { lastTraversalAt = Date.now(); });
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    bootedByHistory = nav?.type === 'back_forward' || nav?.type === 'reload';
  } catch { /* no Navigation Timing: treat as a plain load */ }
}

function arrivedByHistory(): boolean {
  return bootedByHistory || Date.now() - lastTraversalAt < TRAVERSAL_WINDOW_MS || peekFeedReturn();
}

function spendArrival(): void {
  bootedByHistory = false;
  lastTraversalAt = 0;
  clearFeedReturn();
}

interface Args {
  /** The feed's URL search (filters), which is what a position belongs to */
  feedKey: string;
  /** Posts loaded right now */
  loaded: number;
  /** The feed has real data for this key (not a leftover from the previous filters) */
  ready: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchFailed: boolean;
  fetchNextPage: () => unknown;
}

export function useFeedScrollRestore({ feedKey, loaded, ready, hasNextPage, isFetchingNextPage, fetchFailed, fetchNextPage }: Args) {
  // Decided once per feed URL, on the way in. Reading storage is a render-time read, not a write,
  // so React's double render in development is harmless; the arrival is spent in the effect below.
  const [target, setTarget] = useState<{ key: string; pos: FeedPosition | null }>(() => ({
    key: feedKey,
    pos: arrivedByHistory() ? readFeedPosition(feedKey) : null,
  }));
  const [finishedKey, setFinishedKey] = useState<string | null>(null);

  // A different filter set is a new feed: start it from the top unless history brought us here
  if (target.key !== feedKey) {
    setTarget({ key: feedKey, pos: arrivedByHistory() ? readFeedPosition(feedKey) : null });
  }
  const pos = target.key === feedKey ? target.pos : null;
  const pending = pos !== null && finishedKey !== feedKey;
  const needsMorePosts = pending && loaded < pos.loaded && hasNextPage && !fetchFailed;

  // The latest values, for saving on the way out
  const latest = useRef({ feedKey, loaded, pending });
  useLayoutEffect(() => { latest.current = { feedKey, loaded, pending }; });

  useLayoutEffect(() => {
    if (!pending || !ready || !pos) return;
    if (needsMorePosts) {
      if (!isFetchingNextPage) void fetchNextPage();
      return;
    }
    const y = pos.y;
    window.scrollTo({ top: y, behavior: 'instant' });
    // Next.js may scroll a freshly opened page to the top just after this; put it back once
    // the page has settled, unless the member has already moved it themselves
    const reassert = () => { if (Math.abs(window.scrollY - y) > 2 && window.scrollY < 5) window.scrollTo({ top: y, behavior: 'instant' }); };
    const frame = requestAnimationFrame(reassert);
    const timer = window.setTimeout(reassert, 150);
    spendArrival();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: the restore is done for this feed
    setFinishedKey(feedKey);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [pending, ready, pos, needsMorePosts, isFetchingNextPage, fetchNextPage, feedKey]);

  // Remember where the member is whenever they leave this feed. A restore still in progress must
  // not overwrite the position it is restoring with the top of a half-loaded list.
  useLayoutEffect(() => {
    const save = () => {
      const { feedKey: k, loaded: n, pending: waiting } = latest.current;
      if (!waiting) saveFeedPosition(k, { y: window.scrollY, loaded: n });
    };
    window.addEventListener('pagehide', save);
    return () => { window.removeEventListener('pagehide', save); save(); };
  }, [feedKey]);

  // Nothing waiting on a restore once the member has seen the feed some other way
  useEffect(() => { if (!pos) spendArrival(); }, [pos]);

  return { restoring: needsMorePosts };
}
