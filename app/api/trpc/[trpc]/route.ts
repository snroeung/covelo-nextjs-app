import { trace } from "@opentelemetry/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { TZ_HEADER, zoneOrUtc } from "@/lib/time";
import { createAuthLoader } from "@/server/trpc";
import { hasSessionCookie } from "@/lib/supabase/session";
import { currentSpans, elapsedMs, proxyAuthSpan, timingExposed, toServerTiming, withTiming } from "@/lib/timing";

/** Cookie names off the Cookie header (values are not needed to tell signed-in from signed-out). */
function cookieNames(req: Request): string[] {
  return (req.headers.get("cookie") ?? "").split(";").map((c) => c.split("=")[0].trim()).filter(Boolean);
}

/** The proxy's auth call (forwarded as a header) first, then everything the resolvers recorded. */
function allSpans(req: Request) {
  const proxy = proxyAuthSpan(req.headers);
  return proxy ? [proxy, ...currentSpans()] : currentSpans();
}

const handler = (req: Request) =>
  withTiming(async () => {
    // Procedure names (comma-joined for a batch) make traces searchable per procedure
    trace.getActiveSpan()?.setAttribute("trpc.path", new URL(req.url).pathname.replace("/api/trpc/", ""));
    const res = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: ({ req }) => ({
        timeZone: zoneOrUtc(req.headers.get(TZ_HEADER)),
        getAuth: createAuthLoader(hasSessionCookie(cookieNames(req))),
      }),
      responseMeta() {
        const header = timingExposed() ? toServerTiming(allSpans(req), elapsedMs()) : "";
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
      spans: allSpans(req).map((s) => ({ l: s.label, ms: Math.round(s.ms), o: s.outcome, ...(s.note ? { n: s.note } : {}), ...(s.proc ? { p: s.proc } : {}) })),
    }));
    return res;
  });

export { handler as GET, handler as POST };
