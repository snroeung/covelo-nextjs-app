'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addBookmark as _add,
  removeBookmark as _remove,
  getBookmarksForTrip,
  type Bookmark,
  type BookmarkType,
} from '@/lib/bookmarks';

export function useBookmarks(trip_id: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    setBookmarks(getBookmarksForTrip(trip_id));
    function sync() { setBookmarks(getBookmarksForTrip(trip_id)); }
    window.addEventListener('covelo:bookmarks', sync);
    return () => window.removeEventListener('covelo:bookmarks', sync);
  }, [trip_id]);

  const add = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input: { type: BookmarkType; title: string; data: any }) => {
      const bm = _add({
        ...input, trip_id,
        item_id: ''
      });
      setBookmarks(getBookmarksForTrip(trip_id));
      return bm;
    },
    [trip_id],
  );

  const remove = useCallback(
    (id: string) => {
      _remove(id);
      setBookmarks(getBookmarksForTrip(trip_id));
    },
    [trip_id],
  );

  const flights = bookmarks.filter((b) => b.type === 'flight');
  const hotels  = bookmarks.filter((b) => b.type === 'hotel');

  return { bookmarks, flights, hotels, add, remove };
}
