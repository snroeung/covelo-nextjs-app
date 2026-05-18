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

export interface NearestAirport extends PlaceLatLng {
  description: string;
  iataCode: string | undefined;
}

/**
 * Returns the most relevant airport for a given city name.
 * Uses Places Autocomplete with "airport" appended, picks the first result
 * that contains an IATA code, then resolves its lat/lng via Place Details.
 */
export async function getNearestAirport(cityName: string): Promise<NearestAirport> {
  const sessionToken = crypto.randomUUID();
  // Use only the primary city name (before the first comma) so autocomplete gets a clean,
  // short query — e.g. "Washington D.C., DC, USA" → "Washington D.C. airport"
  const cityShort = cityName.split(',')[0].trim();
  let suggestions = await getPlaceAutocomplete(`${cityShort} airport`, sessionToken, 'airport');

  // If no results, retry with first word only (e.g. "Washington airport")
  if (suggestions.length === 0) {
    const firstWord = cityShort.split(' ')[0];
    suggestions = await getPlaceAutocomplete(`${firstWord} airport`, sessionToken, 'airport');
  }

  // Prefer results that include an IATA code in the description
  const withIata = suggestions.filter((s) => /\([A-Z]{3}\)/.test(s.description));
  const chosen = withIata[0] ?? suggestions[0];
  if (!chosen) throw new Error(`No airport found for "${cityName}"`);

  const iataMatch = chosen.description.match(/\(([A-Z]{3})\)/);
  const iataCode = iataMatch?.[1];

  const latLng = await getPlaceLatLng(chosen.placeId, sessionToken);
  return { ...latLng, description: chosen.description, iataCode };
}

/**
 * Returns lat/lng for a placeId.
 * Results are cached in Redis by placeId for 30 days — coordinates don't change,
 * so any user resolving the same place hits the cache, not the API.
 * Passing the sessionToken ends the billing session (this is the only billed call).
 */
/**
 * Returns a photo_reference for a place identified by name + address.
 * The caller should construct a server-side proxy URL from this reference
 * (e.g. /api/place-photo?ref=REFERENCE) so the API key is never exposed.
 * Results are cached in Redis for 7 days.
 */
export async function getPlacePhoto(name: string, address: string): Promise<string | null> {
  if (!GMAPS_KEY) return null;

  const cacheKey = `place:photo:ref:${name}:${address}`;
  const cached = await redis.get<string>(cacheKey);
  if (cached) return cached;

  const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  findUrl.searchParams.set('input', `${name} ${address}`);
  findUrl.searchParams.set('inputtype', 'textquery');
  findUrl.searchParams.set('fields', 'photos');
  findUrl.searchParams.set('key', GMAPS_KEY);

  const findRes = await fetch(findUrl.toString());
  const findData = await findRes.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photoRef: string | undefined = findData.candidates?.[0]?.photos?.[0]?.photo_reference;
  if (!photoRef) return null;

  await redis.set(cacheKey, photoRef, { ex: 60 * 60 * 24 * 7 });
  return photoRef;
}

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
