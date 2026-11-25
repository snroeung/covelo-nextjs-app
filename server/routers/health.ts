import { router, flaggedProcedure } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { redis } from "@/lib/redis";
import { CACHE, cacheKeys } from "@/lib/cache-config";

export interface LocationHealth {
  places: boolean;
  mapbox: boolean;
}

/** True when the request reaches the service and gets a non-error response. */
async function reachable(fn: () => Promise<Response>): Promise<boolean> {
  try {
    return (await fn()).ok;
  } catch {
    return false;
  }
}

export const healthRouter = router({
  /**
   * Reachability of the location services behind the search box (Google Places, Mapbox).
   * Checked once on page load (and polled) to drive the "Location search is temporarily
   * unavailable" banner from a stable signal instead of per-keystroke query errors.
   *
   * Cached in Redis for 30s so page loads read the cache, not the live APIs — one real
   * probe per window globally. A service whose integration flag is OFF is reported healthy
   * (the banner is for real outages, not feature flags).
   */
  location: flaggedProcedure("api:health").query(async (): Promise<LocationHealth> => {
    const cacheKey = cacheKeys.locationHealth();

    if (isEnabled("integration:redis:places")) {
      try {
        const cached = await redis.get<LocationHealth>(cacheKey);
        if (cached) return cached;
      } catch {
        // Redis down — fall through to a live probe.
      }
    }

    const gmaps = process.env.GOOGLE_MAPS_API_KEY ?? "";
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY ?? "";

    const [places, mapbox] = await Promise.all([
      !isEnabled("integration:google-places:places")
        ? Promise.resolve(true)
        : reachable(() =>
            fetch("https://places.googleapis.com/v1/places:autocomplete", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Goog-Api-Key": gmaps },
              body: JSON.stringify({ input: "a", sessionToken: crypto.randomUUID(), languageCode: "en" }),
            }),
          ),
      !isEnabled("integration:mapbox")
        ? Promise.resolve(true)
        : reachable(() =>
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/a.json?access_token=${mapboxToken}&limit=1`),
          ),
    ]);

    const result: LocationHealth = { places, mapbox };

    if (isEnabled("integration:redis:places")) {
      try {
        await redis.set(cacheKey, result, { ex: CACHE.locationHealth.ttl });
      } catch {
        // Non-fatal.
      }
    }

    return result;
  }),
});
