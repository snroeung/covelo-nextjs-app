import { z } from "zod";
import { publicProcedure, router } from "@/server/trpc";
import { duffel } from "@/lib/duffel";

export const flightsRouter = router({
  searchOffers: publicProcedure
    .input(
      z.object({
        origin: z.string().length(3, "Must be a 3-letter IATA airport code"),
        destination: z.string().length(3, "Must be a 3-letter IATA airport code"),
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        passengers: z.number().int().min(1).max(9),
        cabinClass: z
          .enum(["economy", "premium_economy", "business", "first"])
          .optional()
          .default("economy"),
      })
    )
    .mutation(async ({ input }) => {
      const { origin, destination, departureDate, passengers, cabinClass } = input;

      const offerRequest = await duffel.offerRequests.create({
        slices: [
          {
            origin,
            destination,
            departure_date: departureDate,
          },
        ],
        passengers: Array.from({ length: passengers }, () => ({ type: "adult" as const })),
        cabin_class: cabinClass,
      });

      return offerRequest.data;
    }),
});
