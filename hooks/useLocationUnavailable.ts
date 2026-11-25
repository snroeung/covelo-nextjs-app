import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Stable "is the location search (Google Places) down right now?" signal for the
 * unavailable banner. Backed by the `health.location` endpoint, which is cached ~30s
 * server-side — so each check is cheap (mostly a Redis read) and non-blocking. Replaces
 * reacting to per-keystroke autocomplete errors, which flickered.
 *
 * Checked: once on mount (session start), again when the tab is refocused or the network
 * reconnects (session resuming after a stall), and on a 5-minute poll.
 */
export function useLocationUnavailable(): boolean {
  const { data } = useQuery({
    queryKey: ['health.location'],
    queryFn: () => trpc.health.location.query(),
    staleTime: 60_000,            // a refocus/reconnect after ~1 min re-checks
    refetchInterval: FIVE_MINUTES,
    refetchOnWindowFocus: true,   // resume after a stall (tab refocused)
    refetchOnReconnect: true,     // resume after a stall (network back)
    retry: false,
  });
  // Mapbox is only the fallback; the banner is about autocomplete (Places) being reachable.
  return !!data && !data.places;
}
