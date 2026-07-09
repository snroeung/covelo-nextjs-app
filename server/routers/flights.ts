import { createHash } from "crypto";
import { z } from "zod";
import { flaggedProcedure, router } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { CACHE, cacheKeys } from "@/lib/cache-config";
import { redis } from "@/lib/redis";
import { TRPCError } from "@trpc/server";
import { duffel } from "@/lib/duffel";

// Redis helpers that respect the integration:redis:flights flag.
// Flag off → reads miss, writes no-op (same graceful-degradation pattern as stays).
async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isEnabled("integration:redis:flights")) return null;
  return redis.get<T>(key).catch(() => null);
}
async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!isEnabled("integration:redis:flights")) return;
  await redis.set(key, value, { ex: ttl }).catch(() => {});
}

export const flightsRouter = router({
  searchOffers: flaggedProcedure("api:flights")
    .input(
      z.object({
        origin: z.string().length(3, "Must be a 3-letter IATA airport code"),
        destination: z.string().length(3, "Must be a 3-letter IATA airport code"),
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        // Round-trip: include returnDate. Omit for one-way.
        returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
        passengers: z.number().int().min(1).max(9),
        cabinClass: z
          .enum(["economy", "premium_economy", "business", "first"])
          .optional()
          .default("economy"),
      })
    )
    .mutation(async ({ input }) => {
      const { origin, destination, departureDate, returnDate, passengers, cabinClass } = input;

      // Cache-first: live search is deterministic for ~15 min.
      const rawKey = `${origin}|${destination}|${departureDate}|${returnDate ?? ""}|${passengers}|${cabinClass}`;
      const key = cacheKeys.flightSearch(createHash("sha256").update(rawKey).digest("hex"));
      const ttl = CACHE.flightSearch.ttl;
      const cached = await cacheGet<unknown>(key);
      if (cached) return cached;

      if (!isEnabled("integration:duffel:flights")) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flight search integration is not available in this environment.",
        });
      }

      const slices = [
        { origin, destination, departure_date: departureDate, arrival_time: null, departure_time: null },
        ...(returnDate ? [{ origin: destination, destination: origin, departure_date: returnDate, arrival_time: null, departure_time: null }] : []),
      ];

      const offerRequest = await duffel.offerRequests.create({
        slices,
        passengers: Array.from({ length: passengers }, () => ({ type: "adult" as const })),
        cabin_class: cabinClass,
      });

      await cacheSet(key, offerRequest.data, ttl);
      return offerRequest.data;
    }),

  // Illustrative /search marquee. Fans out one-way searches server-side and caches
  // the *whole* result — including empty/failed routes — for 24h, so it never
  // re-hits Duffel on repeat visits and never competes with a user's real search.
  board: flaggedProcedure("api:flights")
    .input(
      z.object({
        origin: z.string().length(3),
        destinations: z.array(z.string().length(3)).min(1).max(12),
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input }) => {
      const { origin, destinations, departureDate } = input;
      const rawKey = `${origin}|${destinations.join(",")}|${departureDate}`;
      const key = cacheKeys.flightBoard(createHash("sha256").update(rawKey).digest("hex"));
      const cached = await cacheGet<unknown>(key);
      if (cached) return cached;

      if (!isEnabled("integration:duffel:flights")) return [];

      // One cheapest offer per route. Per-route try/catch means a dead route (e.g. no
      // scheduled service) yields null instead of aborting the whole board.
      const results = await Promise.all(
        destinations.map(async (destination) => {
          try {
            const offerRequest = await duffel.offerRequests.create({
              slices: [{ origin, destination, departure_date: departureDate, arrival_time: null, departure_time: null }],
              passengers: [{ type: "adult" as const }],
              cabin_class: "economy",
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let cheapest: any = null;
            for (const o of offerRequest.data?.offers ?? []) {
              const p = parseFloat(o?.total_amount ?? "");
              if (!p) continue;
              if (!cheapest || p < parseFloat(cheapest.total_amount)) cheapest = o;
            }
            return cheapest;
          } catch {
            return null;
          }
        })
      );

      const payload = results.filter((o) => o != null);
      // Cache even when empty so dead routes don't re-fire Duffel on every visit.
      await cacheSet(key, payload, CACHE.flightBoard.ttl);
      return payload;
    }),
});
