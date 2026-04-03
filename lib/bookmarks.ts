// Saved flight/hotel bookmarks per trip.
// Stored separately from the core Trip schema so the data model stays clean
// until the backend itinerary API is wired up.

export type BookmarkType = 'flight' | 'hotel';

export interface Bookmark {
  id: string;
  trip_id: string;
  type: BookmarkType;
  item_id: string;     // unique ID from the API (offer.id / accommodation.id) — used for dedup
  title: string;       // human-readable label shown on the trip page
  saved_at: string;    // ISO timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;           // raw offer / searchResult for future use
}

const KEY = 'covelo_bookmarks';

function load(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Bookmark[];
  } catch {
    return [];
  }
}

function persist(items: Bookmark[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  // Notify same-tab listeners (storage event only fires in other tabs)
  window.dispatchEvent(new Event('covelo:bookmarks'));
}

export function addBookmark(input: Omit<Bookmark, 'id' | 'saved_at'>): Bookmark {
  const bookmark: Bookmark = {
    ...input,
    id: crypto.randomUUID(),
    saved_at: new Date().toISOString(),
  };
  // Deduplicate by trip + item_id (each unique offer/accommodation gets one slot per trip)
  const existing = load().filter(
    (b) => !(b.trip_id === input.trip_id && b.item_id === input.item_id),
  );
  persist([...existing, bookmark]);
  return bookmark;
}

export function removeBookmark(id: string): void {
  persist(load().filter((b) => b.id !== id));
}

export function getBookmarksForTrip(trip_id: string): Bookmark[] {
  return load().filter((b) => b.trip_id === trip_id);
}

// Returns the bookmark id if this item is already saved to the given trip, else null.
// Falls back to title matching for legacy bookmarks that pre-date the item_id field.
export function findBookmark(trip_id: string, item_id: string, titleFallback?: string): string | null {
  return load().find((b) =>
    b.trip_id === trip_id &&
    (b.item_id === item_id || (!b.item_id && !!titleFallback && b.title === titleFallback))
  )?.id ?? null;
}
