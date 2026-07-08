import { router } from "@/server/trpc";
import { flightsRouter } from "@/server/routers/flights";
import { staysRouter } from "@/server/routers/stays";
import { placesRouter } from "@/server/routers/places";
import { offersRouter } from "@/server/routers/offers";

export const appRouter = router({
  flights: flightsRouter,
  stays: staysRouter,
  places: placesRouter,
  offers: offersRouter,
});

export type AppRouter = typeof appRouter;
