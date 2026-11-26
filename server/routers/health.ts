import { router, flaggedProcedure } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { redis } from "@/lib/redis";
import { CACHE, cacheKeys } from "@/lib/cache-config";

export interface LocationHealth {
  places: boolean;
  mapbox: boolean;
}

const PROBE_TIMEOUT_MS = 3000;
const MEMO_TTL_MS = CACHE.locationHealth.ttl * 1000;

// Per-instance throttle: even if Redis is unavailable (or a stampede hits on a miss), each
// server probes the billable upstreams at most once per window. `inflight` additionally
// coalesces concurrent callers on a cold/expired memo onto a single probe.
let memo: { at: number; value: LocationHealth } | null = null;
let inflight: Promise<LocationHealth> | null = null;

/** Test seam — clears the per-instance caches between cases. */
export function __resetLocationHealthCache(): void {
  memo = null;
  inflight = null;
}

/** True when the request reaches the service and gets a non-error response. */
async function reachable(fn: () => Promise<Response>): Promise<boolean> {
  try {
    return (await fn()).ok;
  } catch {
    return false;
  }
}

async function probe(): Promise<LocationHealth> {
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
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          }),
        ),
    !isEnabled("integration:mapbox")
      ? Promise.resolve(true)
      : reachable(() =>
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/a.json?access_token=${mapboxToken}&limit=1`, {
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          }),
        ),
  ]);

  return { places, mapbox };
}

/**
 * Reachability of the location services behind the search box (Google Places, Mapbox).
 * Two cache layers keep the billable probes rare: a per-instance memo (bounds probes even
 * when Redis is down) in front of a shared Redis cache (~30s). Each probe has a 3s timeout
 * so a hung upstream can't stall the request. A
 * service whose integration flag is OFF is reported healthy — the banner is for real
 * outages, not feature flags.
 */
export async function getLocationHealth(): Promise<LocationHealth> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.value;
  // Concurrent callers on a cold/expired memo share one resolution (and one probe).
  inflight ??= resolveLocationHealth().finally(() => { inflight = null; });
  return inflight;
}

async function resolveLocationHealth(): Promise<LocationHealth> {
  const cacheKey = cacheKeys.locationHealth();

  if (isEnabled("integration:redis:places")) {
    try {
      const cached = await redis.get<LocationHealth>(cacheKey);
      if (cached) {
        memo = { at: Date.now(), value: cached };
        return cached;
      }
    } catch {
      // Redis down — fall through to a live probe.
    }
  }

  const result = await probe();
  memo = { at: Date.now(), value: result };

  if (isEnabled("integration:redis:places")) {
    try {
      await redis.set(cacheKey, result, { ex: CACHE.locationHealth.ttl });
    } catch {
      // Non-fatal.
    }
  }

  return result;
}

export const healthRouter = router({
  /** Polled by the client (mount, refocus/reconnect, 5-min interval) to drive the banner. */
  location: flaggedProcedure("api:health").query(() => getLocationHealth()),
});
