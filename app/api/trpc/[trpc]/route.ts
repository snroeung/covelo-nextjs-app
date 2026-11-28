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

/**
 * tRPC's own JSON error envelope for the whole request, used only when
 * `fetchRequestHandler` itself throws (router/context load failure) rather than
 * returning its normal per-procedure error response. Without this the handler
 * would reject and Next would emit an empty-body 500 — which the tRPC client
 * then chokes on with "Failed to execute 'json' on 'Response': Unexpected end
 * of JSON input" instead of surfacing a usable error. Always a parseable body.
 */
function jsonErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        message: "Internal server error",
        code: -32603, // JSON-RPC INTERNAL_ERROR
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      },
    }),
    { status: 500, headers: { "content-type": "application/json" } },
  );
}

const handler = (req: Request) =>
  withTiming(async () => {
    // Procedure names (comma-joined for a batch) make traces searchable per procedure
    trace.getActiveSpan()?.setAttribute("trpc.path", new URL(req.url).pathname.replace("/api/trpc/", ""));
    let res: Response;
    try {
      res = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: ({ req }) => ({
          timeZone: zoneOrUtc(req.headers.get(TZ_HEADER)),
          getAuth: createAuthLoader(hasSessionCookie(cookieNames(req))),
        }),
        responseMeta() {
          // Must never throw: a thrown responseMeta discards an otherwise-valid
          // response and leaves the client with an empty body to JSON-parse.
          try {
            const header = timingExposed() ? toServerTiming(allSpans(req), elapsedMs()) : "";
            return header ? { headers: { "Server-Timing": header } } : {};
          } catch {
            return {};
          }
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
    } catch (err) {
      // fetchRequestHandler normally serializes resolver errors itself; reaching here means it
      // threw before producing a Response (e.g. a router module or createContext failure). Return
      // a parseable JSON body so the client errors cleanly instead of on an empty response body.
      console.error({
        time: new Date().toISOString(),
        path: "<request>",
        status: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
      return jsonErrorResponse();
    }
    // Perf logging is best-effort and must never discard the real response.
    try {
      console.info("[perf]", JSON.stringify({
        path: new URL(req.url).pathname.replace("/api/trpc/", ""),
        total: Math.round(elapsedMs()),
        spans: allSpans(req).map((s) => ({ l: s.label, ms: Math.round(s.ms), o: s.outcome, ...(s.note ? { n: s.note } : {}), ...(s.proc ? { p: s.proc } : {}) })),
      }));
    } catch {
      /* never let logging turn a good response into an empty 500 */
    }
    return res;
  });

export { handler as GET, handler as POST };
