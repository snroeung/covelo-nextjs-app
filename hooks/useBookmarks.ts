'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  addBookmark as _add,
  removeBookmark as _remove,
  getBookmarksForTrip,
  type BookmarkType,
} from '@/lib/bookmarks';

function subscribe(callback: () => void) {
  window.addEventListener('covelo:bookmarks', callback);
  return () => window.removeEventListener('covelo:bookmarks', callback);
}

export function useBookmarks(trip_id: string) {
  const bookmarks = useSyncExternalStore(
    subscribe,
    () => getBookmarksForTrip(trip_id),
    () => [],
  );

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
