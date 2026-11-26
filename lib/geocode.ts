import { redis } from './redis';
import { isEnabled } from './feature-flags';
import { CACHE, cacheKeys } from './cache-config';
import type { PlaceLatLng } from './places';

/**
 * Mapbox forward geocoding — the text→coordinates fallback used when Google Places
 * autocomplete is unavailable (403, flag off, or network error). Google Text Search
 * is the *same* API that fails in that case, so it can't be the fallback; Mapbox is
 * the only other text→coords primitive in the app (it already powers the GeoMap
 * search box, `components/hotels/GeoMap.tsx`).
 *
 * Gated by `integration:mapbox` at the call site (the places router). Results are
 * cached in Redis for a day — a query string maps to stable coordinates — reusing
 * the places Redis kill switch (`integration:redis:places`).
 *
 * Uses the public `NEXT_PUBLIC_MAPBOX_API_KEY` (also readable server-side). Returns
 * the top match, or null only when Mapbox is reached and genuinely has no match.
 * Throws on any unavailability — missing key, non-OK HTTP, or network error — so the
 * caller can tell "no match" apart from "service down" and message accordingly.
 */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY ?? '';
const MAPBOX_GEOCODE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

interface MapboxFeature {
  center?: [number, number]; // [lng, lat]
  text?: string;
  place_name?: string;
}

export async function geocodeText(query: string): Promise<PlaceLatLng | null> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;
  if (!MAPBOX_TOKEN) throw new Error('Mapbox geocoding is not configured (NEXT_PUBLIC_MAPBOX_API_KEY missing)');

  const cacheKey = cacheKeys.geocode(trimmed);

  if (isEnabled('integration:redis:places')) {
    try {
      const cached = await redis.get<PlaceLatLng>(cacheKey);
      if (cached) return cached;
    } catch (err) {
      console.warn('[geocode] Redis read failed, falling through to Mapbox:', err);
    }
  }

  const url =
    `${MAPBOX_GEOCODE}/${encodeURIComponent(trimmed)}.json` +
    `?access_token=${MAPBOX_TOKEN}&types=place,address,poi,neighborhood,locality&limit=1`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error('[geocode] Mapbox forward geocode failed', { status: res.status });
    throw new Error(`Mapbox forward geocode failed: ${res.status}`);
  }

  const data = (await res.json()) as { features?: MapboxFeature[] };
  const top = data.features?.[0];
  // Reached Mapbox, but it has no result for this query — a genuine no-match, not an outage.
  if (!top?.center) return null;

  const [longitude, latitude] = top.center;
  const result: PlaceLatLng = {
    latitude,
    longitude,
    name: top.text ?? top.place_name?.split(',')[0].trim() ?? trimmed,
  };

  if (isEnabled('integration:redis:places')) {
    try {
      await redis.set(cacheKey, result, { ex: CACHE.geocode.ttl });
    } catch {
      // Redis unavailable — still return the result
    }
  }

  return result;
}
