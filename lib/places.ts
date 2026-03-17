import { redis } from './redis';

const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export interface PlaceLatLng {
  latitude: number;
  longitude: number;
  name: string;
}

/**
 * Calls Places Autocomplete API.
 * All autocomplete calls in a session share the same sessionToken — they are free.
 * Only the final Place Details call (getPlaceLatLng) is billed.
 */
export async function getPlaceAutocomplete(
  input: string,
  sessionToken: string,
  types?: string,
): Promise<PlaceSuggestion[]> {
  if (!GMAPS_KEY) throw new Error('GOOGLE_MAPS_API_KEY is not set');

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', input);
  url.searchParams.set('sessiontoken', sessionToken);
  if (types) url.searchParams.set('types', types);
  url.searchParams.set('key', GMAPS_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places autocomplete failed: ${data.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.predictions ?? []).map((p: any) => ({
    placeId: p.place_id,
    description: p.description,
  }));
}

/**
 * Returns lat/lng for a placeId.
 * Results are cached in Redis by placeId for 30 days — coordinates don't change,
 * so any user resolving the same place hits the cache, not the API.
 * Passing the sessionToken ends the billing session (this is the only billed call).
 */
export async function getPlaceLatLng(
  placeId: string,
  sessionToken: string,
): Promise<PlaceLatLng> {
  const cacheKey = `place:latlng:${placeId}`;

  // Cache hit
  const cached = await redis.get<PlaceLatLng>(cacheKey);
  if (cached) return cached;

  // Cache miss → call Place Details (this call closes the session and is billed)
  if (!GMAPS_KEY) throw new Error('GOOGLE_MAPS_API_KEY is not set');

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'geometry,name');
  url.searchParams.set('sessiontoken', sessionToken);
  url.searchParams.set('key', GMAPS_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== 'OK') {
    console.error('[places] Place Details failed', { placeId, status: data.status, error_message: data.error_message });
    throw new Error(`Place details failed: ${data.status}`);
  }

  const { lat, lng } = data.result.geometry.location;
  const result: PlaceLatLng = { latitude: lat, longitude: lng, name: data.result.name };

  // 30-day TTL — coordinates are effectively permanent
  await redis.set(cacheKey, result, { ex: 60 * 60 * 24 * 30 });

  return result;
}
