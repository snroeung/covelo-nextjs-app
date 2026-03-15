import { router } from "@/server/trpc";
import { flightsRouter } from "@/server/routers/flights";

export const appRouter = router({
  flights: flightsRouter,
});

export type AppRouter = typeof appRouter;
