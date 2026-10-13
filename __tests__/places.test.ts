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
import { getAirportsForQuery, getHotelGoogleReviews } from '@/lib/places';

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

const NRT = { place_id: 'nrt_id', description: 'Narita International Airport (NRT), Narita, Chiba, Japan' };
const HND = { place_id: 'hnd_id', description: 'Haneda Airport (HND), Ota, Tokyo, Japan' };
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
    (isEnabled as Mock).mockReturnValue(true);
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
  });

  it('matches a bundled IATA code without calling Google — covers airports like CUN that Google\'s text match misses', async () => {
    let googleCalled = false;
    server.use(http.get(AUTOCOMPLETE_URL, () => {
      googleCalled = true;
      return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
    }));

    const result = await getAirportsForQuery('CUN', 'session-1');

    expect(result[0]).toEqual({ placeId: 'iata:CUN', description: expect.stringContaining('(CUN)') });
    expect(googleCalled).toBe(false);
  });

  it('matches a bundled airport by city name', async () => {
    const result = await getAirportsForQuery('Cancun', 'session-1');

    expect(result).toEqual([{ placeId: 'iata:CUN', description: expect.stringContaining('(CUN)') }]);
  });

  it('falls back to Google for a direct match when nothing in the bundled list matches', async () => {
    server.use(
      http.get(AUTOCOMPLETE_URL, ({ request }) => {
        const types = new URL(request.url).searchParams.get('types');
        if (types === 'airport') {
          return HttpResponse.json({
            status: 'OK',
            predictions: [{ place_id: 'made_up_id', description: 'Made Up Private Strip (ZZZ), Nowhere' }],
          });
        }
        return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
      }),
    );

    const result = await getAirportsForQuery('zzzznonexistentplace', 'session-1');

    expect(result).toEqual([{ placeId: 'made_up_id', description: 'Made Up Private Strip (ZZZ), Nowhere' }]);
  });

  it('falls back to a country\'s airports when neither the bundled list nor a direct Google match exist', async () => {
    mockJapanAirports();

    const result = await getAirportsForQuery('Japan', 'session-1');

    expect(result).toEqual([
      { placeId: 'nrt_id', description: NRT.description },
      { placeId: 'hnd_id', description: HND.description },
    ]);
  });

  it('returns an empty list when the input matches neither a bundled airport, a direct Google match, nor a country', async () => {
    server.use(http.get(AUTOCOMPLETE_URL, () => HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] })));

    const result = await getAirportsForQuery('asdfqwerasdfqwer', 'session-1');

    expect(result).toEqual([]);
  });

  it('caches the resolved country airport list and reuses it on the next lookup', async () => {
    let countryCallCount = 0;
    mockJapanAirports(() => { countryCallCount += 1; });

    await getAirportsForQuery('Japan', 'session-1');
    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value, opts] = (redis.set as Mock).mock.calls[0];
    expect(key).toBe('place:country-airports:JP');
    expect(value).toEqual([
      { placeId: 'nrt_id', description: NRT.description },
      { placeId: 'hnd_id', description: HND.description },
    ]);
    expect(opts).toEqual({ ex: 60 * 60 * 24 });
    expect(countryCallCount).toBe(1);

    // Second lookup: cache hit skips the live country-restricted autocomplete call.
    (redis.get as Mock).mockResolvedValue([
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

  it('skips the Google fallback entirely when the Google Places integration is disabled', async () => {
    (isEnabled as Mock).mockReturnValue(false);
    let googleCalled = false;
    server.use(http.get(AUTOCOMPLETE_URL, () => {
      googleCalled = true;
      return HttpResponse.json({ status: 'ZERO_RESULTS', predictions: [] });
    }));

    const result = await getAirportsForQuery('zzzznonexistentplace', 'session-1');

    expect(result).toEqual([]);
    expect(googleCalled).toBe(false);
  });
});

// ── Google hotel reviews (Places API (New)) ──────────────────────────────────

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_URL = 'https://places.googleapis.com/v1/places/:id';
const HOTEL = { id: 'duffel_acc_1', name: 'The Logan Philadelphia', lat: 39.9566, lng: -75.1700 };
const GID_KEY = 'place:hotel-gid:duffel_acc_1';

function placeBody(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gid_logan',
    displayName: { text: 'The Logan Philadelphia' },
    location: { latitude: 39.9567, longitude: -75.1702 },
    rating: 4.5,
    userRatingCount: 2310,
    googleMapsUri: 'https://maps.google.com/?cid=1',
    googleMapsLinks: { reviewsUri: 'https://www.google.com/maps/place//data=reviews' },
    reviewSummary: {
      text: { text: 'Guests praise the location.' },
      disclosureText: { text: 'Summarized with Gemini' },
      flagContentUri: 'https://www.google.com/local/review/rap/report?summary',
      reviewsUri: 'https://www.google.com/maps/place//data=reviews',
    },
    reviews: [{
      rating: 5,
      text: { text: 'Lovely stay.' },
      relativePublishTimeDescription: '2 weeks ago',
      authorAttribution: { displayName: 'Ana P', uri: 'https://www.google.com/maps/contrib/1', photoUri: 'https://lh3.googleusercontent.com/a/1' },
      googleMapsUri: 'https://www.google.com/maps/reviews/1',
      flagContentUri: 'https://www.google.com/local/review/rap/report?1',
      visitDate: { year: 2026, month: 3 },
    }],
    ...overrides,
  };
}

describe('getHotelGoogleReviews', () => {
  let searchCalls: Array<{ fieldMask: string | null; body: Record<string, unknown> }>;
  let detailCalls: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    (isEnabled as Mock).mockReturnValue(true);
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
    searchCalls = [];
    detailCalls = [];
  });

  function mockGoogle(opts: { searchId?: string | null; details?: (id: string) => Response } = {}) {
    const searchId = opts.searchId === undefined ? 'gid_logan' : opts.searchId;
    server.use(
      http.post(SEARCH_URL, async ({ request }) => {
        searchCalls.push({ fieldMask: request.headers.get('X-Goog-FieldMask'), body: await request.json() as Record<string, unknown> });
        return HttpResponse.json(searchId ? { places: [{ id: searchId }] } : {});
      }),
      http.get(PLACE_URL, ({ params }) => {
        const id = params.id as string;
        detailCalls.push(id);
        return opts.details ? opts.details(id) : HttpResponse.json(placeBody({ id }));
      }),
    );
  }

  it('finds the place with an IDs-only, lodging-only text search near the hotel', async () => {
    mockGoogle();
    await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0].fieldMask).toBe('places.id,places.movedPlaceId');
    expect(searchCalls[0].body).toMatchObject({
      textQuery: HOTEL.name,
      includedType: 'lodging',
      strictTypeFiltering: true,
      pageSize: 1,
      locationBias: { circle: { center: { latitude: HOTEL.lat, longitude: HOTEL.lng } } },
    });
  });

  it('normalizes rating, links, Gemini summary and author-attributed reviews', async () => {
    mockGoogle();
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(result).toEqual({
      rating: 4.5,
      ratingCount: 2310,
      mapsUri: 'https://maps.google.com/?cid=1',
      reviewsUri: 'https://www.google.com/maps/place//data=reviews',
      summary: {
        text: 'Guests praise the location.',
        disclosure: 'Summarized with Gemini',
        flagUri: 'https://www.google.com/local/review/rap/report?summary',
      },
      reviews: [{
        author: 'Ana P',
        authorUri: 'https://www.google.com/maps/contrib/1',
        authorPhotoUri: 'https://lh3.googleusercontent.com/a/1',
        rating: 5,
        text: 'Lovely stay.',
        relativeTime: '2 weeks ago',
        visitDate: { year: 2026, month: 3 },
        reviewUri: 'https://www.google.com/maps/reviews/1',
        flagUri: 'https://www.google.com/local/review/rap/report?1',
      }],
    });
  });

  it('maps a missing reviewSummary to null', async () => {
    mockGoogle({ details: (id) => HttpResponse.json(placeBody({ id, reviewSummary: undefined })) });
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);
    expect(result?.summary).toBeNull();
  });

  it('caches only the place ID — never review content', async () => {
    mockGoogle();
    await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(GID_KEY, 'gid_logan', { ex: 60 * 60 * 24 * 365 });
  });

  it('skips the search when the place ID is cached', async () => {
    (redis.get as Mock).mockResolvedValue('gid_cached');
    mockGoogle();
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(searchCalls).toHaveLength(0);
    expect(detailCalls).toEqual(['gid_cached']);
    expect(result?.rating).toBe(4.5);
  });

  it('a cached "none" marker short-circuits with no Google calls', async () => {
    (redis.get as Mock).mockResolvedValue('none');
    mockGoogle();
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(result).toBeNull();
    expect(searchCalls).toHaveLength(0);
    expect(detailCalls).toHaveLength(0);
  });

  it('no search match caches "none" and skips the paid details call', async () => {
    mockGoogle({ searchId: null });
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(result).toBeNull();
    expect(detailCalls).toHaveLength(0);
    expect(redis.set).toHaveBeenCalledWith(GID_KEY, 'none', expect.anything());
  });

  it('a match more than 500 m away is a different hotel — null, cached as "none"', async () => {
    mockGoogle({ details: (id) => HttpResponse.json(placeBody({ id, location: { latitude: 39.97, longitude: -75.17 } })) });
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(result).toBeNull();
    expect(redis.set).toHaveBeenLastCalledWith(GID_KEY, 'none', expect.anything());
  });

  it('an obsolete cached ID (NOT_FOUND) re-runs the search once and caches the new ID', async () => {
    (redis.get as Mock).mockResolvedValue('gid_stale');
    mockGoogle({
      searchId: 'gid_fresh',
      details: (id) => id === 'gid_stale'
        ? HttpResponse.json({ error: { status: 'NOT_FOUND' } }, { status: 404 })
        : HttpResponse.json(placeBody({ id })),
    });
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(detailCalls).toEqual(['gid_stale', 'gid_fresh']);
    expect(searchCalls).toHaveLength(1);
    expect(redis.set).toHaveBeenCalledWith(GID_KEY, 'gid_fresh', expect.anything());
    expect(result?.rating).toBe(4.5);
  });

  it('a movedPlaceId replaces the cached ID', async () => {
    (redis.get as Mock).mockResolvedValue('gid_old');
    mockGoogle({ details: (id) => HttpResponse.json(placeBody({ id, movedPlaceId: 'gid_new' })) });
    await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(redis.set).toHaveBeenCalledWith(GID_KEY, 'gid_new', expect.anything());
  });

  it('flag off returns null without calling Google or Redis', async () => {
    (isEnabled as Mock).mockImplementation((flag: string) => flag !== 'integration:google-places:reviews');
    mockGoogle();
    const result = await getHotelGoogleReviews(HOTEL.id, HOTEL.name, HOTEL.lat, HOTEL.lng);

    expect(result).toBeNull();
    expect(searchCalls).toHaveLength(0);
    expect(detailCalls).toHaveLength(0);
    expect(redis.get).not.toHaveBeenCalled();
  });
});
