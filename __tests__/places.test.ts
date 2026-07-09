import { vi, beforeEach, describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/lib/feature-flags', () => ({
  isEnabled: () => true,
}));

import { redis } from '@/lib/redis';
import { getAirportsForQuery } from '@/lib/places';

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

const NRT = { place_id: 'nrt_id', description: 'Narita International Airport (NRT), Narita, Chiba, Japan' };
const HND = { place_id: 'hnd_id', description: 'Haneda Airport (HND), Ota, Tokyo, Japan' };
const JFK = { place_id: 'jfk_id', description: 'John F. Kennedy International Airport (JFK), Queens, NY, USA' };
const JAPAN = { place_id: 'japan_id', types: ['country', 'political'] };

function mockJapanAirports(onCountryCall?: () => void) {
  server.use(
    http.get(AUTOCOMPLETE_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const types = params.get('types');
      const components = params.get('components');

      if (types === 'airport' && components === 'country:JP') {
        onCountryCall?.();
        return HttpResponse.json({ status: 'OK', predictions: [NRT, HND] });
      }
      if (types === 'airport') return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
      if (types === '(regions)') return HttpResponse.json({ status: 'OK', predictions: [JAPAN] });
      return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
    }),
    http.get(DETAILS_URL, () => HttpResponse.json({
      status: 'OK',
      result: { address_components: [{ types: ['country', 'political'], short_name: 'JP', long_name: 'Japan' }] },
    })),
  );
}

describe('getAirportsForQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (redis.get as any).mockResolvedValue(null);
    (redis.set as any).mockResolvedValue('OK');
  });

  it('returns direct airport matches without any country fallback calls', async () => {
    let detailsCalled = false;
    server.use(
      http.get(AUTOCOMPLETE_URL, ({ request }) => {
        const types = new URL(request.url).searchParams.get('types');
        if (types === 'airport') return HttpResponse.json({ status: 'OK', predictions: [JFK] });
        return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
      }),
      http.get(DETAILS_URL, () => {
        detailsCalled = true;
        return HttpResponse.json({ status: 'OK', result: {} });
      }),
    );

    const result = await getAirportsForQuery('JFK', 'session-1');

    expect(result).toEqual([{ placeId: 'jfk_id', description: JFK.description }]);
    expect(detailsCalled).toBe(false);
  });

  it('falls back to a country\'s airports when the direct airport search is empty', async () => {
    mockJapanAirports();

    const result = await getAirportsForQuery('Japan', 'session-1');

    expect(result).toEqual([
      { placeId: 'nrt_id', description: NRT.description },
      { placeId: 'hnd_id', description: HND.description },
    ]);
  });

  it('returns an empty list when the input matches neither an airport nor a country', async () => {
    server.use(
      http.get(AUTOCOMPLETE_URL, ({ request }) => {
        const types = new URL(request.url).searchParams.get('types');
        if (types === '(regions)') return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
        return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
      }),
    );

    const result = await getAirportsForQuery('asdfqwer', 'session-1');

    expect(result).toEqual([]);
  });

  it('caches the resolved country airport list and reuses it on the next lookup', async () => {
    let countryCallCount = 0;
    mockJapanAirports(() => { countryCallCount += 1; });

    await getAirportsForQuery('Japan', 'session-1');
    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value, opts] = (redis.set as any).mock.calls[0];
    expect(key).toBe('place:country-airports:JP');
    expect(value).toEqual([
      { placeId: 'nrt_id', description: NRT.description },
      { placeId: 'hnd_id', description: HND.description },
    ]);
    expect(opts).toEqual({ ex: 60 * 60 * 24 });
    expect(countryCallCount).toBe(1);

    // Second lookup: cache hit skips the live country-restricted autocomplete call.
    (redis.get as any).mockResolvedValue([
      { placeId: 'nrt_id', description: NRT.description },
      { placeId: 'hnd_id', description: HND.description },
    ]);

    const result = await getAirportsForQuery('Japan', 'session-2');

    expect(result).toEqual([
      { placeId: 'nrt_id', description: NRT.description },
      { placeId: 'hnd_id', description: HND.description },
    ]);
    expect(countryCallCount).toBe(1);
  });
});
