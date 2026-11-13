import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveFeedPosition, readFeedPosition, markFeedReturn, peekFeedReturn, clearFeedReturn,
  POSITION_MAX_AGE_MS, RETURN_MAX_AGE_MS, MIN_RESTORE_Y, type PositionStore,
} from '@/lib/board/feedPosition';

function memoryStore(): PositionStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const NOW = 1_700_000_000_000;

describe('feed position', () => {
  let store: ReturnType<typeof memoryStore>;
  beforeEach(() => { store = memoryStore(); });

  it('round-trips the offset and how many posts were loaded', () => {
    saveFeedPosition('?sort=new', { y: 8533.4, loaded: 60 }, store, NOW);
    expect(readFeedPosition('?sort=new', store, NOW + 1000)).toEqual({ y: 8533, loaded: 60, at: NOW });
  });

  it('keeps one position per feed URL', () => {
    saveFeedPosition('', { y: 900, loaded: 20 }, store, NOW);
    saveFeedPosition('?type=tip', { y: 4000, loaded: 40 }, store, NOW);
    expect(readFeedPosition('', store, NOW)?.y).toBe(900);
    expect(readFeedPosition('?type=tip', store, NOW)?.y).toBe(4000);
    expect(readFeedPosition('?type=offer', store, NOW)).toBeNull();
  });

  it('forgets a position once the feed was left at the top, or empty', () => {
    saveFeedPosition('', { y: 900, loaded: 20 }, store, NOW);
    saveFeedPosition('', { y: MIN_RESTORE_Y - 1, loaded: 20 }, store, NOW);
    expect(readFeedPosition('', store, NOW)).toBeNull();

    saveFeedPosition('', { y: 900, loaded: 20 }, store, NOW);
    saveFeedPosition('', { y: 900, loaded: 0 }, store, NOW);
    expect(readFeedPosition('', store, NOW)).toBeNull();
  });

  it('lets a position expire', () => {
    saveFeedPosition('', { y: 900, loaded: 20 }, store, NOW);
    expect(readFeedPosition('', store, NOW + POSITION_MAX_AGE_MS)).not.toBeNull();
    expect(readFeedPosition('', store, NOW + POSITION_MAX_AGE_MS + 1)).toBeNull();
  });

  it('ignores anything in storage that is not a position we wrote', () => {
    const bad = ['not json', 'null', '"x"', '{}', '{"y":"9","loaded":20,"at":1}', `{"y":900,"loaded":2.5,"at":${NOW}}`,
      `{"y":900,"loaded":0,"at":${NOW}}`, `{"y":900,"loaded":5000,"at":${NOW}}`, `{"y":-5,"loaded":20,"at":${NOW}}`,
      `{"y":900,"loaded":20,"at":${NOW + 10 * 60_000}}`];
    for (const raw of bad) {
      store.setItem('covelo:board:feed-pos:', raw);
      expect(readFeedPosition('', store, NOW)).toBeNull();
    }
  });

  it('does nothing, and does not throw, without storage or when it is blocked', () => {
    expect(() => saveFeedPosition('', { y: 900, loaded: 20 }, null, NOW)).not.toThrow();
    expect(readFeedPosition('', null, NOW)).toBeNull();
    const blocked: PositionStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(() => saveFeedPosition('', { y: 900, loaded: 20 }, blocked, NOW)).not.toThrow();
    expect(readFeedPosition('', blocked, NOW)).toBeNull();
    expect(() => markFeedReturn(blocked, NOW)).not.toThrow();
    expect(peekFeedReturn(blocked, NOW)).toBe(false);
  });
});

describe('returning from a post', () => {
  it('is waiting only briefly after "The board" was clicked, and can be cleared', () => {
    const store = memoryStore();
    expect(peekFeedReturn(store, NOW)).toBe(false);
    markFeedReturn(store, NOW);
    expect(peekFeedReturn(store, NOW + 5000)).toBe(true);
    expect(peekFeedReturn(store, NOW + RETURN_MAX_AGE_MS)).toBe(true);
    expect(peekFeedReturn(store, NOW + RETURN_MAX_AGE_MS + 1)).toBe(false);
    clearFeedReturn(store);
    expect(peekFeedReturn(store, NOW + 1000)).toBe(false);
  });

  it('peeking does not use it up', () => {
    const store = memoryStore();
    markFeedReturn(store, NOW);
    expect(peekFeedReturn(store, NOW)).toBe(true);
    expect(peekFeedReturn(store, NOW)).toBe(true);
  });
});
