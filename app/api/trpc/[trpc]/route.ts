import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { TZ_HEADER, zoneOrUtc } from "@/lib/time";
import { currentSpans, elapsedMs, toServerTiming, withTiming } from "@/lib/timing";

const handler = (req: Request) =>
  withTiming(async () => {
    const res = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: ({ req }) => ({ timeZone: zoneOrUtc(req.headers.get(TZ_HEADER)) }),
      responseMeta() {
        const header = toServerTiming(currentSpans(), elapsedMs());
        return header ? { headers: { "Server-Timing": header } } : {};
      },
      onError({ error, path }) {
        console.error({
          time: new Date().toISOString(),
          path,
          status: error.code,
          message: error.message,
        });
      },
    });
    console.info("[perf]", JSON.stringify({
      path: new URL(req.url).pathname.replace("/api/trpc/", ""),
      total: Math.round(elapsedMs()),
      spans: currentSpans().map((s) => ({ l: s.label, ms: Math.round(s.ms), o: s.outcome, ...(s.note ? { n: s.note } : {}) })),
    }));
    return res;
  });

export { handler as GET, handler as POST };
