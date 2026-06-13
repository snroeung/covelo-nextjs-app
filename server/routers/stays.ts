import { createHash } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { flaggedProcedure, router } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { CACHE, cacheKeys } from "@/lib/cache-config";
import { duffel } from "@/lib/duffel";
import { redis } from "@/lib/redis";
import { searchHotels } from "@/lib/hotelbeds";
import { adaptHotelBedsResults } from "@/lib/adapters/hotelbeds-adapter";
import { matchHotels } from "@/lib/hotelbeds-match";

// Redis helpers that respect the integration:redis flag.
// When the flag is off, reads return null (cache miss) and writes are no-ops,
// reusing the existing graceful-degradation pattern.
async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isEnabled("integration:redis:stays")) return null;
  return redis.get<T>(key).catch(() => null);
}
async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!isEnabled("integration:redis:stays")) return;
  await redis.set(key, value, { ex: ttl }).catch(() => {});
}

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
  return cacheKeys.hotelBedsSearch(createHash("sha256").update(raw).digest("hex"));
}

interface AccommodationStaticDetails {
  description: string | null;
  check_in_information: { check_in_after_time: string; check_out_before_time: string } | null;
  reviews: Array<{ created_at: string; reviewer_name: string; score: number; text: string }>;
  roomPhotosByName: Record<string, Array<{ url: string }>>;
}

interface RoomSummary {
  name: string;
  beds: Array<{ type: string; count: number }>;
  photos: Array<{ url: string }>;
  rates: Array<{
    id: string;
    total_amount: string;
    total_currency: string;
    board_type: string;
    payment_type: string;
    quantity_available: number | null;
    cancellation_timeline: Array<{ refund_amount: string; before: string; currency: string }>;
  }>;
}

export const staysRouter = router({
  accommodationDetails: flaggedProcedure("api:stays")
    .input(z.object({ accommodationId: z.string(), searchResultId: z.string() }))
    .query(async ({ input }) => {
      if (!isEnabled("integration:duffel:stays")) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hotel details integration is not available in this environment.",
        });
      }

      const staticKey = cacheKeys.stayDetails(input.accommodationId);
      const roomsKey  = cacheKeys.stayRooms(input.searchResultId);

      // Fetch static details (24h cache) and rooms (15 min cache) independently
      const [cachedStatic, cachedRooms] = await Promise.all([
        cacheGet<AccommodationStaticDetails>(staticKey),
        cacheGet<RoomSummary[]>(roomsKey),
      ]);

      // Run only the API calls we still need
      const [detailsOutcome, reviewsOutcome, ratesOutcome] = await Promise.allSettled([
        cachedStatic ? Promise.resolve(null) : duffel.stays.accommodation.get(input.accommodationId),
        cachedStatic ? Promise.resolve(null) : duffel.stays.accommodation.reviews(input.accommodationId),
        cachedRooms  ? Promise.resolve(null) : duffel.stays.searchResults.fetchAllRates(input.searchResultId),
      ]);

      let staticDetails = cachedStatic;
      if (!staticDetails) {
        const roomPhotosByName: Record<string, Array<{ url: string }>> = {};
        if (detailsOutcome.status === "fulfilled" && detailsOutcome.value) {
          for (const room of detailsOutcome.value.data.rooms ?? []) {
            if (room.photos?.length) {
              roomPhotosByName[room.name] = room.photos.map((p) => ({ url: p.url }));
            }
          }
        }
        staticDetails = {
          description:
            detailsOutcome.status === "fulfilled" && detailsOutcome.value
              ? (detailsOutcome.value.data.description ?? null)
              : null,
          check_in_information:
            detailsOutcome.status === "fulfilled" && detailsOutcome.value
              ? detailsOutcome.value.data.check_in_information
              : null,
          reviews:
            reviewsOutcome.status === "fulfilled" && reviewsOutcome.value
              ? reviewsOutcome.value.data.reviews.slice(0, 6)
              : [],
          roomPhotosByName,
        };
        await cacheSet(staticKey, staticDetails, CACHE.stayDetails.ttl);
      }

      let rooms = cachedRooms;
      if (!rooms) {
        if (ratesOutcome.status === "fulfilled" && ratesOutcome.value) {
          const rawRooms = ratesOutcome.value.data.accommodation.rooms ?? [];
          const photosByName = staticDetails.roomPhotosByName ?? {};
          rooms = rawRooms.map((r) => {
            const ratePhotos = (r.photos ?? []).map((p) => ({ url: p.url }));
            const photos = ratePhotos.length > 0 ? ratePhotos : (photosByName[r.name] ?? []);
            return {
              name: r.name,
              beds: (r.beds ?? []).map((b) => ({ type: b.type, count: b.count })),
              photos,
              rates: r.rates.map((rt) => ({
                id: rt.id,
                total_amount: rt.total_amount,
                total_currency: rt.total_currency,
                board_type: rt.board_type,
                payment_type: rt.payment_type,
                quantity_available: rt.quantity_available ?? null,
                cancellation_timeline: (rt.cancellation_timeline ?? []).map((c) => ({
                  refund_amount: c.refund_amount,
                  before: c.before,
                  currency: c.currency,
                })),
              })),
            };
          });
          console.log(`[stays] fetchAllRates ${input.searchResultId} → ${rooms!.length} rooms`);
          rooms!.forEach((r) => {
            const src = r.photos.length > 0
              ? (photosByName[r.name]?.length && r.photos[0].url === photosByName[r.name][0].url ? "accommodation.get" : "fetchAllRates")
              : "none";
            console.log(
              `[stays]   room "${r.name}"  photos=${r.photos.length} (src=${src})  rates=${r.rates.length}`,
            );
          });
        } else {
          if (ratesOutcome.status === "rejected") {
            console.warn("[stays] fetchAllRates ✗", ratesOutcome.reason);
          }
          rooms = [];
        }
        await cacheSet(roomsKey, rooms, CACHE.stayRooms.ttl);
      }

      return { ...staticDetails, rooms };
    }),

  search: flaggedProcedure("api:stays")
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
      if (!isEnabled("integration:duffel:stays")) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hotel search integration is not available in this environment.",
        });
      }

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
          if (!isEnabled("integration:hotelbeds:stays")) {
            console.log("[stays] HotelBeds disabled via feature flag — skipping");
            return [];
          }

          const cacheKey = hbCacheKey(latitude, longitude, checkInDate, checkOutDate, rooms, adults, children);
          const cached = await cacheGet<ReturnType<typeof adaptHotelBedsResults>>(cacheKey);
          if (cached) {
            console.log(`[stays] HotelBeds ✓ ${cached.length} hotels (cache hit)`);
            cached.forEach((h) => console.log(`[stays]   hb: ${h.name} $${h.lowestRateUsd.toFixed(2)} ${h.currency}`));
            return cached;
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

          await cacheSet(cacheKey, normalized, CACHE.hotelBedsSearch.ttl);

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
      if (isEnabled("integration:redis:stays")) {
        try {
          await Promise.all(
            searchResults.map((sr) =>
              redis.set(
                cacheKeys.staySearchResult(sr.accommodation.id, checkInDate, checkOutDate, rooms),
                sr,
                { ex: CACHE.staySearchResult.ttl },
              )
            )
          );
        } catch (err) {
          console.warn("[stays] Redis cache write failed:", err);
        }
      }

      // Augment each result with HotelBeds portal prices where available
      return searchResults.map((sr) => {
        const portalPrices = portalPricesMap.get(sr.accommodation.id);
        return portalPrices ? { ...sr, portalPrices } : sr;
      });
    }),
});
