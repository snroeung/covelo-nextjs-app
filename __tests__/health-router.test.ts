import { vi, beforeEach, describe, it, expect, type Mock } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';

vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock('@/lib/feature-flags', () => ({ isEnabled: vi.fn() }));

import { redis } from '@/lib/redis';
import { isEnabled } from '@/lib/feature-flags';
import { getLocationHealth, __resetLocationHealthCache } from '@/server/routers/health';

const PLACES_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const MAPBOX_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/:q';

function mockProbes(placesOk: boolean, mapboxOk: boolean) {
  server.use(
    http.post(PLACES_URL, () =>
      placesOk ? HttpResponse.json({ suggestions: [] }) : new HttpResponse(null, { status: 500 })),
    http.get(MAPBOX_URL, () =>
      mapboxOk ? HttpResponse.json({ features: [] }) : new HttpResponse(null, { status: 500 })),
  );
}

describe('getLocationHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetLocationHealthCache();
    (isEnabled as Mock).mockReturnValue(true); // all relevant flags on by default
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
    mockProbes(true, true);
  });

  it('returns the Redis-cached value without probing', async () => {
    (redis.get as Mock).mockResolvedValue({ places: false, mapbox: true });
    expect(await getLocationHealth()).toEqual({ places: false, mapbox: true });
  });

  it('probes on a cache miss and writes the result to Redis', async () => {
    expect(await getLocationHealth()).toEqual({ places: true, mapbox: true });
    expect(redis.set as Mock).toHaveBeenCalled();
  });

  it('falls through to a probe when the Redis read throws', async () => {
    (redis.get as Mock).mockRejectedValue(new Error('redis down'));
    expect(await getLocationHealth()).toEqual({ places: true, mapbox: true });
  });

  it('reports a flag-off service as healthy without probing it', async () => {
    (isEnabled as Mock).mockImplementation((f: string) => f === 'integration:redis:places'); // places + mapbox off
    mockProbes(false, false); // would fail if probed — but they must be skipped
    expect(await getLocationHealth()).toEqual({ places: true, mapbox: true });
  });

  it('reports places:false on a non-ok Places probe', async () => {
    mockProbes(false, true);
    expect(await getLocationHealth()).toEqual({ places: false, mapbox: true });
  });

  it('reports mapbox:false on a non-ok Mapbox probe', async () => {
    mockProbes(true, false);
    expect(await getLocationHealth()).toEqual({ places: true, mapbox: false });
  });

  it('serves the per-instance memo on the next call without reading Redis again', async () => {
    await getLocationHealth(); // miss → probe + memo
    (redis.get as Mock).mockClear();
    expect(await getLocationHealth()).toEqual({ places: true, mapbox: true });
    expect(redis.get as Mock).not.toHaveBeenCalled();
  });
});

describe('getLocationHealth — in-flight coalescing', () => {
  const MEMO_EXPIRED = 60_000; // past the 30s memo window

  beforeEach(() => {
    vi.clearAllMocks();
    __resetLocationHealthCache();
    (isEnabled as Mock).mockReturnValue(true);
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
  });

  it('concurrent callers on a cold cache share a single probe', async () => {
    let placesHits = 0;
    let mapboxHits = 0;
    server.use(
      http.post(PLACES_URL, () => { placesHits += 1; return HttpResponse.json({ suggestions: [] }); }),
      http.get(MAPBOX_URL, () => { mapboxHits += 1; return HttpResponse.json({ features: [] }); }),
    );

    const results = await Promise.all(Array.from({ length: 5 }, () => getLocationHealth()));

    for (const r of results) expect(r).toEqual({ places: true, mapbox: true });
    expect(placesHits).toBe(1);
    expect(mapboxHits).toBe(1);
    expect(redis.get as Mock).toHaveBeenCalledTimes(1);
  });

  it('clears the in-flight slot once the probe settles, so a later call probes again', async () => {
    let placesHits = 0;
    server.use(
      http.post(PLACES_URL, () => { placesHits += 1; return HttpResponse.json({ suggestions: [] }); }),
      http.get(MAPBOX_URL, () => HttpResponse.json({ features: [] })),
    );

    await getLocationHealth();
    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(realNow + MEMO_EXPIRED);
    try {
      await getLocationHealth(); // memo expired + nothing in flight → a fresh probe
    } finally {
      nowSpy.mockRestore();
    }
    expect(placesHits).toBe(2);
  });

  it('a probe settling after a reset does not clear the newer in-flight probe', async () => {
    let placesHits = 0;
    let releaseA!: () => void;
    let releaseB!: () => void;
    const gateA = new Promise<void>((r) => { releaseA = r; });
    const gateB = new Promise<void>((r) => { releaseB = r; });
    server.use(
      http.post(PLACES_URL, async () => {
        const n = ++placesHits;
        await (n === 1 ? gateA : gateB);
        return HttpResponse.json({ suggestions: [] });
      }),
      http.get(MAPBOX_URL, () => HttpResponse.json({ features: [] })),
    );

    const a = getLocationHealth();   // probe A, held open
    __resetLocationHealthCache();    // test seam drops A mid-flight
    const b = getLocationHealth();   // probe B, held open

    releaseA();
    await a;                         // A settles — must leave B's in-flight slot alone

    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(realNow + MEMO_EXPIRED);
    try {
      const c = getLocationHealth(); // memo expired → must join B, not start probe #3
      releaseB();
      await Promise.all([b, c]);
    } finally {
      nowSpy.mockRestore();
    }
    expect(placesHits).toBe(2);
  });
});
