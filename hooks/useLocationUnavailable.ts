import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { LocationHealth } from '@/server/routers/health';

const FIVE_MINUTES = 5 * 60 * 1000;

/** Page banner shows when Places is unreachable. Mapbox doesn't gate it (see isMapUnavailable). */
export function isLocationUnavailable(data: LocationHealth | undefined): boolean {
  return !!data && !data.places;
}

/** Map-view banner shows when Mapbox is unreachable. Scoped to the map — not the page. */
export function isMapUnavailable(data: LocationHealth | undefined): boolean {
  return !!data && !data.mapbox;
}

/**
 * Location-service health (Google Places + Mapbox) from the `health.location` endpoint,
 * which is cached ~30s server-side — so each check is cheap (mostly a Redis read) and
 * non-blocking. Every caller shares one query (same key), so the page banner and the map
 * banner cost a single request.
 *
 * Checked: once on mount (session start), again when the tab is refocused or the network
 * reconnects (session resuming after a stall), and on a 5-minute poll.
 */
function useLocationHealth(): LocationHealth | undefined {
  const { data } = useQuery({
    queryKey: ['health.location'],
    queryFn: () => trpc.health.location.query(),
    staleTime: 60_000,            // a refocus/reconnect after ~1 min re-checks
    refetchInterval: FIVE_MINUTES,
    refetchOnWindowFocus: true,   // resume after a stall (tab refocused)
    refetchOnReconnect: true,     // resume after a stall (network back)
    retry: false,
  });
  return data;
}

/** Is location search (Google Places) down? Drives the page-top banner. */
export function useLocationUnavailable(): boolean {
  return isLocationUnavailable(useLocationHealth());
}

/** Is Mapbox down? Drives the banner inside the map view only. */
export function useMapUnavailable(): boolean {
  return isMapUnavailable(useLocationHealth());
}
