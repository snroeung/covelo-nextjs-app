import { z } from "zod";
import { publicProcedure, router } from "@/server/trpc";
import { duffel } from "@/lib/duffel";
import { geocodeLocation } from "@/lib/geocode";

const guestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("adult") }),
  z.object({ type: z.literal("child"), age: z.number().int().min(0).max(17) }),
]);

export const staysRouter = router({
  search: publicProcedure
    .input(
      z.object({
        location: z.string().min(1, "Location is required"),
        radius: z.number().positive().default(5),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        rooms: z.number().int().min(1).default(1),
        guests: z.array(guestSchema).min(1),
        freeCancellationOnly: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const { location, radius, checkInDate, checkOutDate, rooms, guests, freeCancellationOnly } =
        input;

      const { latitude, longitude } = await geocodeLocation(location);

      // NOTE: Duffel Stays API requires separate product access.
      // Access has been requested but is pending approval from Duffel.
      // This will return an error until access is granted.
      let result;
      try {
        result = await duffel.stays.search({
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
      } catch (e: unknown) {
        const message =
          e instanceof Error && e.message
            ? e.message
            : `Duffel stays search failed: ${JSON.stringify(e)}`;
        throw new Error(message);
      }

      return result.data;
    }),
});
