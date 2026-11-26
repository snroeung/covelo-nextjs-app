import { vi, beforeEach, describe, it, expect, type Mock } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/lib/feature-flags', () => ({
  isEnabled: vi.fn(),
}));

import { redis } from '@/lib/redis';
import { isEnabled } from '@/lib/feature-flags';
import { geocodeText } from '@/lib/geocode';

const MAPBOX_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/:query';

/** Mapbox forward-geocode feature: center is [lng, lat]. */
const PARIS_FEATURE = {
  center: [2.3488, 48.8534] as [number, number],
  text: 'Paris',
  place_name: 'Paris, France',
};

function mockMapbox(features: unknown[], onCall?: () => void) {
  server.use(
    http.get(MAPBOX_URL, () => {
      onCall?.();
      return HttpResponse.json({ features });
    }),
  );
}

describe('geocodeText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isEnabled as Mock).mockReturnValue(true);
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
  });

  it('returns {latitude, longitude, name} for the top match (center is [lng, lat])', async () => {
    mockMapbox([PARIS_FEATURE]);
    const result = await geocodeText('paris');
    expect(result).toEqual({ latitude: 48.8534, longitude: 2.3488, name: 'Paris' });
  });

  it('returns null when Mapbox has no matches', async () => {
    mockMapbox([]);
    expect(await geocodeText('zzzzzz')).toBeNull();
  });

  it('returns null for queries shorter than 2 chars without calling Mapbox', async () => {
    let called = false;
    mockMapbox([PARIS_FEATURE], () => { called = true; });
    expect(await geocodeText('p')).toBeNull();
    expect(called).toBe(false);
  });

  it('serves a cached result without calling Mapbox', async () => {
    const cached = { latitude: 1, longitude: 2, name: 'Cached City' };
    (redis.get as Mock).mockResolvedValue(cached);
    let called = false;
    mockMapbox([PARIS_FEATURE], () => { called = true; });

    expect(await geocodeText('paris')).toEqual(cached);
    expect(called).toBe(false);
  });

  it('writes the result to Redis on a cache miss', async () => {
    mockMapbox([PARIS_FEATURE]);
    await geocodeText('paris');
    expect(redis.set as Mock).toHaveBeenCalledWith(
      'place:geocode:paris',
      { latitude: 48.8534, longitude: 2.3488, name: 'Paris' },
      expect.objectContaining({ ex: expect.any(Number) }),
    );
  });

  it('skips Redis entirely when the places cache flag is off', async () => {
    (isEnabled as Mock).mockReturnValue(false);
    mockMapbox([PARIS_FEATURE]);

    const result = await geocodeText('paris');
    expect(result).toEqual({ latitude: 48.8534, longitude: 2.3488, name: 'Paris' });
    expect(redis.get as Mock).not.toHaveBeenCalled();
    expect(redis.set as Mock).not.toHaveBeenCalled();
  });

  it('throws (not a no-match) when Mapbox responds with an error status', async () => {
    server.use(http.get(MAPBOX_URL, () => new HttpResponse(null, { status: 500 })));
    await expect(geocodeText('paris')).rejects.toThrow(/500/);
  });

  it('throws (not a no-match) on a network failure reaching Mapbox', async () => {
    server.use(http.get(MAPBOX_URL, () => HttpResponse.error()));
    await expect(geocodeText('paris')).rejects.toThrow();
  });

  it('falls back to the place_name head when a feature has no text', async () => {
    mockMapbox([{ center: [2.3488, 48.8534], place_name: 'Paris, France' }]);
    const result = await geocodeText('paris');
    expect(result?.name).toBe('Paris');
  });
});
