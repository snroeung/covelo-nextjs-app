import { z } from "zod";
import { flaggedProcedure, router } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { TRPCError } from "@trpc/server";
import { duffel } from "@/lib/duffel";

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
      if (!isEnabled("integration:duffel:flights")) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flight search integration is not available in this environment.",
        });
      }

      const { origin, destination, departureDate, returnDate, passengers, cabinClass } = input;

      const slices = [
        { origin, destination, departure_date: departureDate, arrival_time: null, departure_time: null },
        ...(returnDate ? [{ origin: destination, destination: origin, departure_date: returnDate, arrival_time: null, departure_time: null }] : []),
      ];

      const offerRequest = await duffel.offerRequests.create({
        slices,
        passengers: Array.from({ length: passengers }, () => ({ type: "adult" as const })),
        cabin_class: cabinClass,
      });

      return offerRequest.data;
    }),
});
