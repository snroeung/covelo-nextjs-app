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
import { getAirportsForQuery, getHotelGoogleReviews, getNearestAirport, getPlaceLatLng, getPlacePhoto } from '@/lib/places';

// Places API (New): Autocomplete is POST, Place Details is GET v1/places/:id.
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/:id';

const NRT = { place_id: 'nrt_id', description: 'Narita International Airport (NRT), Narita, Chiba, Japan' };
const HND = { place_id: 'hnd_id', description: 'Haneda Airport (HND), Ota, Tokyo, Japan' };
const JAPAN = { place_id: 'japan_id', description: 'Japan', types: ['country', 'political'] };

type AutocompleteBody = { includedPrimaryTypes?: string[]; includedRegionCodes?: string[] };

/** Builds an Autocomplete (New) suggestion from the legacy-shaped fixtures above. */
function suggestion(p: { place_id: string; description: string; types?: string[] }) {
  return { placePrediction: { placeId: p.place_id, text: { text: p.description }, types: p.types } };
}

function mockJapanAirports(onCountryCall?: () => void) {
  server.use(
    http.post(AUTOCOMPLETE_URL, async ({ request }) => {
      const body = (await request.json()) as AutocompleteBody;
      const primary = body.includedPrimaryTypes?.[0];
      const region = body.includedRegionCodes?.[0];

      if (primary === 'airport' && region === 'jp') {
        onCountryCall?.();
        return HttpResponse.json({ suggestions: [suggestion(NRT), suggestion(HND)] });
      }
      if (primary === 'airport') return HttpResponse.json({ suggestions: [] });
      if (primary === 'country') return HttpResponse.json({ suggestions: [suggestion(JAPAN)] });
      return HttpResponse.json({ suggestions: [] });
    }),
    http.get(DETAILS_URL, () => HttpResponse.json({
      addressComponents: [{ types: ['country', 'political'], shortText: 'JP', longText: 'Japan' }],
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
    server.use(http.post(AUTOCOMPLETE_URL, () => {
      googleCalled = true;
      return HttpResponse.json({ suggestions: [] });
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
      http.post(AUTOCOMPLETE_URL, async ({ request }) => {
        const body = (await request.json()) as AutocompleteBody;
        if (body.includedPrimaryTypes?.[0] === 'airport') {
          return HttpResponse.json({
            suggestions: [suggestion({ place_id: 'made_up_id', description: 'Made Up Private Strip (ZZZ), Nowhere' })],
          });
        }
        return HttpResponse.json({ suggestions: [] });
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
    server.use(http.post(AUTOCOMPLETE_URL, () => HttpResponse.json({ suggestions: [] })));

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
    server.use(http.post(AUTOCOMPLETE_URL, () => {
      googleCalled = true;
      return HttpResponse.json({ suggestions: [] });
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

// ── getPlaceLatLng (Place Details New) ───────────────────────────────────────

const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places/:id';

describe('getPlaceLatLng', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isEnabled as Mock).mockReturnValue(true);
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
  });

  it('resolves a bundled airport from the static list without calling Google', async () => {
    let called = false;
    server.use(http.get(PLACE_DETAILS_URL, () => { called = true; return HttpResponse.json({}); }));

    const result = await getPlaceLatLng('iata:CUN', 'session-1');

    expect(typeof result.latitude).toBe('number');
    expect(typeof result.longitude).toBe('number');
    expect(result.name).toBeTruthy();
    expect(called).toBe(false);
  });

  it('fetches lat/lng + name from Place Details (New) with the right field mask and caches it', async () => {
    let fieldMask: string | null = null;
    server.use(http.get(PLACE_DETAILS_URL, ({ request }) => {
      fieldMask = request.headers.get('X-Goog-FieldMask');
      return HttpResponse.json({ location: { latitude: 39.95, longitude: -75.17 }, displayName: { text: 'The Logan' } });
    }));

    const result = await getPlaceLatLng('gid_logan', 'session-1');

    expect(fieldMask).toBe('location,displayName');
    expect(result).toEqual({ latitude: 39.95, longitude: -75.17, name: 'The Logan' });
    expect(redis.set).toHaveBeenCalledWith('place:latlng:gid_logan', result, { ex: 60 * 60 * 24 * 30 });
  });

  it('returns a cached lat/lng without calling Google', async () => {
    (redis.get as Mock).mockResolvedValue({ latitude: 1, longitude: 2, name: 'Cached' });
    let called = false;
    server.use(http.get(PLACE_DETAILS_URL, () => { called = true; return HttpResponse.json({}); }));

    const result = await getPlaceLatLng('gid_x', 'session-1');

    expect(result).toEqual({ latitude: 1, longitude: 2, name: 'Cached' });
    expect(called).toBe(false);
  });

  it('throws when Place Details responds non-OK', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(PLACE_DETAILS_URL, () => new HttpResponse('nope', { status: 500 })));

    await expect(getPlaceLatLng('gid_bad', 'session-1')).rejects.toThrow('Place details failed: 500');
    err.mockRestore();
  });
});

// ── getPlacePhoto (Text Search New → photo resource name) ────────────────────

describe('getPlacePhoto', () => {
  const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

  beforeEach(() => {
    vi.clearAllMocks();
    (isEnabled as Mock).mockReturnValue(true);
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
  });

  it('returns a photo resource name from Text Search (New) and caches it under the v2 key', async () => {
    let fieldMask: string | null = null;
    let body: Record<string, unknown> = {};
    server.use(http.post(SEARCH_URL, async ({ request }) => {
      fieldMask = request.headers.get('X-Goog-FieldMask');
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ places: [{ photos: [{ name: 'places/X/photos/Y' }] }] });
    }));

    const result = await getPlacePhoto('The Logan', '1 Logan Sq');

    expect(fieldMask).toBe('places.photos');
    expect(body).toMatchObject({ textQuery: 'The Logan 1 Logan Sq', pageSize: 1 });
    expect(result).toBe('places/X/photos/Y');
    expect(redis.set).toHaveBeenCalledWith('place:photo:v2:ref:The Logan:1 Logan Sq', 'places/X/photos/Y', { ex: 60 * 60 * 24 * 7 });
  });

  it('returns a cached photo name without calling Google', async () => {
    (redis.get as Mock).mockResolvedValue('places/cached/photos/Z');
    let called = false;
    server.use(http.post(SEARCH_URL, () => { called = true; return HttpResponse.json({}); }));

    const result = await getPlacePhoto('A', 'B');

    expect(result).toBe('places/cached/photos/Z');
    expect(called).toBe(false);
  });

  it('returns null when the search yields no photo, and caches nothing', async () => {
    server.use(http.post(SEARCH_URL, () => HttpResponse.json({ places: [{}] })));

    const result = await getPlacePhoto('A', 'B');

    expect(result).toBeNull();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('returns null when Text Search responds non-OK', async () => {
    server.use(http.post(SEARCH_URL, () => new HttpResponse('err', { status: 500 })));

    const result = await getPlacePhoto('A', 'B');

    expect(result).toBeNull();
  });
});

// ── getNearestAirport (Autocomplete New → Place Details New) ──────────────────

describe('getNearestAirport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isEnabled as Mock).mockReturnValue(true);
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue('OK');
  });

  it('prefers the IATA-coded suggestion and resolves its lat/lng', async () => {
    server.use(
      http.post(AUTOCOMPLETE_URL, () => HttpResponse.json({
        suggestions: [
          suggestion({ place_id: 'dt_phl', description: 'Philadelphia, PA, USA' }),
          suggestion({ place_id: 'phl_airport', description: 'Philadelphia International Airport (PHL), PA, USA' }),
        ],
      })),
      http.get(PLACE_DETAILS_URL, () => HttpResponse.json({
        location: { latitude: 39.8729, longitude: -75.2437 },
        displayName: { text: 'Philadelphia International Airport' },
      })),
    );

    const result = await getNearestAirport('Philadelphia, PA, USA');

    expect(result).toEqual({
      latitude: 39.8729,
      longitude: -75.2437,
      name: 'Philadelphia International Airport',
      description: 'Philadelphia International Airport (PHL), PA, USA',
      iataCode: 'PHL',
    });
  });

  it('retries with the first word when the full city name returns nothing', async () => {
    const inputs: string[] = [];
    server.use(
      http.post(AUTOCOMPLETE_URL, async ({ request }) => {
        const body = (await request.json()) as { input: string };
        inputs.push(body.input);
        if (body.input === 'Washington D.C. airport') return HttpResponse.json({ suggestions: [] });
        return HttpResponse.json({ suggestions: [suggestion({ place_id: 'iad', description: 'Washington Dulles (IAD), VA, USA' })] });
      }),
      http.get(PLACE_DETAILS_URL, () => HttpResponse.json({
        location: { latitude: 38.95, longitude: -77.45 },
        displayName: { text: 'Dulles' },
      })),
    );

    const result = await getNearestAirport('Washington D.C., DC, USA');

    expect(inputs).toEqual(['Washington D.C. airport', 'Washington airport']);
    expect(result.iataCode).toBe('IAD');
    expect(result.latitude).toBe(38.95);
  });

  it('throws when no airport is found at all', async () => {
    server.use(http.post(AUTOCOMPLETE_URL, () => HttpResponse.json({ suggestions: [] })));

    await expect(getNearestAirport('Nowhereville')).rejects.toThrow('No airport found for "Nowhereville"');
  });
});
