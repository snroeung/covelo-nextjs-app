import { createHash } from "crypto";
import { z } from "zod";
import { publicProcedure, router } from "@/server/trpc";
import { duffel } from "@/lib/duffel";
import { redis } from "@/lib/redis";
import { searchHotels } from "@/lib/hotelbeds";
import { adaptHotelBedsResults } from "@/lib/adapters/hotelbeds-adapter";
import { matchHotels } from "@/lib/hotelbeds-match";

const guestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("adult") }),
  z.object({ type: z.literal("child"), age: z.number().int().min(0).max(17) }),
]);

function hbCacheKey(
  lat: number,
  lng: number,
  checkIn: string,
  checkOut: string,
  rooms: number,
  adults: number,
  children: number,
): string {
  const raw = `${lat}|${lng}|${checkIn}|${checkOut}|${rooms}|${adults}|${children}`;
  return `hb:search:${createHash("sha256").update(raw).digest("hex")}`;
}

export const staysRouter = router({
  search: publicProcedure
    .input(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        radius: z.number().positive().default(5),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        rooms: z.number().int().min(1).default(1),
        guests: z.array(guestSchema).min(1),
        freeCancellationOnly: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const { latitude, longitude, radius, checkInDate, checkOutDate, rooms, guests, freeCancellationOnly } = input;

      const adults = guests.filter((g) => g.type === "adult").length;
      const children = guests.filter((g) => g.type === "child").length;

      console.log(`[stays] search lat=${latitude} lng=${longitude} ${checkInDate}→${checkOutDate} rooms=${rooms} adults=${adults} children=${children}`);

      // Run Duffel and HotelBeds searches in parallel.
      // HotelBeds failure is non-fatal — results are returned without Amex/Citi price overrides.
      const [duffelOutcome, hbOutcome] = await Promise.allSettled([
        (async () => {
          console.log("[stays] Duffel → calling stays.search");
          const t0 = Date.now();
          const res = await duffel.stays.search({
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            rooms,
            guests,
            free_cancellation_only: freeCancellationOnly,
            location: {
              radius,
              geographic_coordinates: { latitude, longitude },
            },
          });
          console.log(`[stays] Duffel ✓ ${res.data.results.length} hotels (${Date.now() - t0}ms)`);
          return res;
        })(),
        (async () => {
          const cacheKey = hbCacheKey(latitude, longitude, checkInDate, checkOutDate, rooms, adults, children);
          try {
            const cached = await redis.get<ReturnType<typeof adaptHotelBedsResults>>(cacheKey);
            if (cached) {
              console.log(`[stays] HotelBeds ✓ ${cached.length} hotels (cache hit)`);
              cached.forEach((h) => console.log(`[stays]   hb: ${h.name} $${h.lowestRateUsd.toFixed(2)} ${h.currency}`));
              return cached;
            }
          } catch {
            // Redis read failure is non-fatal
          }

          console.log("[stays] HotelBeds → calling hotel-api/1.0/hotels");
          const t0 = Date.now();
          const raw = await searchHotels({
            checkIn: checkInDate,
            checkOut: checkOutDate,
            rooms,
            adults: Math.max(adults, 1),
            children,
            latitude,
            longitude,
            radiusKm: Math.max(radius, 5),
          });

          const normalized = adaptHotelBedsResults(raw);
          console.log(`[stays] HotelBeds ✓ ${normalized.length} hotels (${Date.now() - t0}ms)`);

          try {
            await redis.set(cacheKey, normalized, { ex: 900 });
          } catch {
            // Redis write failure is non-fatal
          }

          return normalized;
        })(),
      ]);

      if (duffelOutcome.status === "rejected") {
        console.error("[stays] Duffel ✗", duffelOutcome.reason);
        throw duffelOutcome.reason;
      }

      const searchResults = duffelOutcome.value.data.results;

      // Build portalPrices map if HotelBeds succeeded
      let portalPricesMap = new Map<string, { amex: number; citi: number }>();
      if (hbOutcome.status === "fulfilled") {
        portalPricesMap = matchHotels(searchResults, hbOutcome.value);
        console.log(`[stays] matched ${portalPricesMap.size}/${searchResults.length} hotels`);
      } else {
        console.warn("[stays] HotelBeds ✗", hbOutcome.reason);
      }

      // Cache Duffel results per accommodation (1h TTL — rates fluctuate)
      try {
        await Promise.all(
          searchResults.map((sr) =>
            redis.set(
              `stay:accommodation:${sr.accommodation.id}:${checkInDate}:${checkOutDate}:${rooms}`,
              sr,
              { ex: 60 * 60 },
            )
          )
        );
      } catch (err) {
        console.warn("[stays] Redis cache write failed:", err);
      }

      // Augment each result with HotelBeds portal prices where available
      return searchResults.map((sr) => {
        const portalPrices = portalPricesMap.get(sr.accommodation.id);
        return portalPrices ? { ...sr, portalPrices } : sr;
      });
    }),
});
