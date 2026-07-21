import { router } from "@/server/trpc";
import { flightsRouter } from "@/server/routers/flights";
import { staysRouter } from "@/server/routers/stays";
import { placesRouter } from "@/server/routers/places";
import { offersRouter } from "@/server/routers/offers";
import { portalDataRouter } from "@/server/routers/portalData";

export const appRouter = router({
  flights: flightsRouter,
  stays: staysRouter,
  places: placesRouter,
  offers: offersRouter,
  portalData: portalDataRouter,
});

export type AppRouter = typeof appRouter;
