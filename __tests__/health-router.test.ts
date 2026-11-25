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
