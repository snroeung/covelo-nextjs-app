import { z } from "zod";
import { publicProcedure, router } from "@/server/trpc";
import { duffel } from "@/lib/duffel";
import { redis } from "@/lib/redis";

const guestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("adult") }),
  z.object({ type: z.literal("child"), age: z.number().int().min(0).max(17) }),
]);

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

      const result = await duffel.stays.search({
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

      // duffel.stays.search returns { data: { results: StaysSearchResult[], created_at } }
      const searchResults = result.data.results;

      // Cache each search result by accommodation ID + date/room params.
      // 1-hour TTL since rates fluctuate throughout the day.
      await Promise.all(
        searchResults.map((sr) =>
          redis.set(
            `stay:accommodation:${sr.accommodation.id}:${checkInDate}:${checkOutDate}:${rooms}`,
            sr,
            { ex: 60 * 60 },
          )
        )
      );

      return searchResults;
    }),
});
