'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  addBookmark as _add,
  removeBookmark as _remove,
  getBookmarksForTrip,
  type Bookmark,
  type BookmarkType,
} from '@/lib/bookmarks';

function subscribe(callback: () => void) {
  window.addEventListener('covelo:bookmarks', callback);
  return () => window.removeEventListener('covelo:bookmarks', callback);
}

const EMPTY: Bookmark[] = [];

export function useBookmarks(trip_id: string) {
  // getBookmarksForTrip() parses localStorage fresh each call, so it returns
  // a new array reference every time even when the data hasn't changed.
  // useSyncExternalStore compares snapshots by reference — an uncached
  // getSnapshot causes it to re-subscribe every render, which is what
  // triggered "Maximum update depth exceeded". Cache by value so the same
  // reference is returned until the underlying data actually changes.
  const cacheRef = useRef<{ trip_id: string; raw: string; value: Bookmark[] } | null>(null);

  const getSnapshot = useCallback(() => {
    const value = getBookmarksForTrip(trip_id);
    const raw = JSON.stringify(value);
    const cache = cacheRef.current;
    if (cache && cache.trip_id === trip_id && cache.raw === raw) {
      return cache.value;
    }
    cacheRef.current = { trip_id, raw, value };
    return value;
  }, [trip_id]);

  const getServerSnapshot = useCallback(() => EMPTY, []);

  const bookmarks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input: { type: BookmarkType; title: string; data: any }) => {
      const bm = _add({
        ...input, trip_id,
        item_id: ''
      });
      return bm;
    },
    [trip_id],
  );

  const remove = useCallback(
    (id: string) => {
      _remove(id);
    },
    [],
  );

  const flights = bookmarks.filter((b) => b.type === 'flight');
  const hotels  = bookmarks.filter((b) => b.type === 'hotel');

  return { bookmarks, flights, hotels, add, remove };
}
