// Where the member was in the feed when they left it, so Back (or "The board" on a post) puts
// them there instead of at the top. Two things are remembered per feed URL: the scroll offset and
// how many posts were loaded, because an infinite feed has to load that many before the offset
// exists. Kept in sessionStorage: per tab, gone when the tab closes. Pure apart from storage and
// the clock, both injectable.

const POSITION_PREFIX = 'covelo:board:feed-pos:';
const RETURN_KEY = 'covelo:board:feed-return';

/** A saved position older than this is stale: the feed has moved on. */
export const POSITION_MAX_AGE_MS = 30 * 60 * 1000;
/** "The board" on a post asks for a restore; the ask lapses if the feed does not open soon. */
export const RETURN_MAX_AGE_MS = 60 * 1000;
/** A feed left near the top has nothing worth restoring. */
export const MIN_RESTORE_Y = 50;
const MAX_LOADED = 1000;

export interface FeedPosition {
  /** window.scrollY when the feed was left */
  y: number;
  /** Posts that were loaded then */
  loaded: number;
  /** When it was saved (ms) */
  at: number;
}

export type PositionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): PositionStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null; // storage blocked: the feed simply opens at the top
  }
}

export function saveFeedPosition(
  key: string,
  pos: { y: number; loaded: number },
  store: PositionStore | null = sessionStore(),
  now: number = Date.now(),
): void {
  if (!store) return;
  try {
    // Nothing to restore from the top of the feed or an empty one: clear any older position
    if (!(pos.y >= MIN_RESTORE_Y) || !(pos.loaded > 0)) {
      store.removeItem(POSITION_PREFIX + key);
      return;
    }
    store.setItem(POSITION_PREFIX + key, JSON.stringify({ y: Math.round(pos.y), loaded: Math.floor(pos.loaded), at: now }));
  } catch { /* storage full or blocked */ }
}

/** The saved position for this feed URL, or null when there is none worth restoring. */
export function readFeedPosition(
  key: string,
  store: PositionStore | null = sessionStore(),
  now: number = Date.now(),
): FeedPosition | null {
  if (!store) return null;
  try {
    const raw = store.getItem(POSITION_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<FeedPosition> | null;
    if (!v || typeof v !== 'object') return null;
    const { y, loaded, at } = v;
    if (typeof y !== 'number' || typeof loaded !== 'number' || typeof at !== 'number') return null;
    if (!Number.isFinite(y) || !Number.isInteger(loaded) || !Number.isFinite(at)) return null;
    if (y < MIN_RESTORE_Y || loaded < 1 || loaded > MAX_LOADED) return null;
    if (now - at > POSITION_MAX_AGE_MS || at > now + 60_000) return null;
    return { y, loaded, at };
  } catch {
    return null;
  }
}

// ─── "The board" link on a post ──────────────────────────────────────────────

/** Called when the member clicks "The board" on a post: the feed they land on should restore. */
export function markFeedReturn(store: PositionStore | null = sessionStore(), now: number = Date.now()): void {
  try { store?.setItem(RETURN_KEY, String(now)); } catch { /* blocked */ }
}

/** True when a recent markFeedReturn is waiting. Does not use it up. */
export function peekFeedReturn(store: PositionStore | null = sessionStore(), now: number = Date.now()): boolean {
  try {
    const at = Number(store?.getItem(RETURN_KEY));
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= RETURN_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function clearFeedReturn(store: PositionStore | null = sessionStore()): void {
  try { store?.removeItem(RETURN_KEY); } catch { /* blocked */ }
}
