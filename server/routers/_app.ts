import { router } from "@/server/trpc";
import { flightsRouter } from "@/server/routers/flights";
import { staysRouter } from "@/server/routers/stays";
import { placesRouter } from "@/server/routers/places";

export const appRouter = router({
  flights: flightsRouter,
  stays: staysRouter,
  places: placesRouter,
});

export type AppRouter = typeof appRouter;
