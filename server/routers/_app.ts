import { router } from "@/server/trpc";
import { flightsRouter } from "@/server/routers/flights";
import { staysRouter } from "@/server/routers/stays";

export const appRouter = router({
  flights: flightsRouter,
  stays: staysRouter,
});

export type AppRouter = typeof appRouter;
