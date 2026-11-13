import { AsyncLocalStorage } from "node:async_hooks";
import { SpanStatusCode, trace } from "@opentelemetry/api";

/** One timed call to a dependency (Duffel, HotelBeds, Supabase, Redis, auth). */
export interface TimingSpan {
  label: string;
  ms: number;
  outcome: "ok" | "error";
  /** Optional detail, e.g. "hit" / "miss" for cache reads. Shown as `desc` in Server-Timing. */
  note?: string;
  /** tRPC procedure that made the call, e.g. "board.posts.list". Tells apart the procedures of one batched request. */
  proc?: string;
}

interface Collector {
  spans: TimingSpan[];
  startedAt: number;
}

const store = new AsyncLocalStorage<Collector>();
const procStore = new AsyncLocalStorage<string>();

/** Runs `fn` as tRPC procedure `name`: every `timed()` call inside is tagged with it. */
export function withProcedure<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return procStore.run(name, fn);
}

/** Max spans kept per request — a page of N per-row calls must not grow the header without bound. */
const MAX_SPANS = 40;

/** Runs `fn` with a fresh per-request collector. Call once at the request edge. */
export function withTiming<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ spans: [], startedAt: performance.now() }, fn);
}

export interface TimedOptions<T> {
  /** Detail for the span, e.g. "hit" / "miss". */
  note?: (result: T) => string | undefined;
  /** For clients that return `{ error }` instead of throwing (Supabase): true marks the span as an error. */
  failed?: (result: T) => boolean;
}

const tracer = trace.getTracer("covelo");

/** "redis.get" → "redis", "board.queryFeed" → "board": the dependency a span belongs to. */
function depOf(label: string): string {
  return label.split(".")[0];
}

/**
 * Times `fn` under `label`. Feeds two sinks: the current request's collector
 * (Server-Timing and the [perf] log — only inside `withTiming`) and an
 * OpenTelemetry span (traces — a no-op until an SDK is registered). Never
 * swallows the result or the error. Span attributes carry no user data.
 */
export function timed<T>(
  label: string,
  fn: () => Promise<T>,
  opts: TimedOptions<T> = {},
): Promise<T> {
  const collector = store.getStore();
  const proc = procStore.getStore();
  const start = performance.now();
  return tracer.startActiveSpan(label, { attributes: { "covelo.dep": depOf(label), ...(proc ? { "trpc.procedure": proc } : {}) } }, async (span) => {
    try {
      const result = await fn();
      const failed = !!opts.failed?.(result);
      const note = opts.note?.(result);
      span.setAttribute("covelo.outcome", failed ? "error" : "ok");
      if (note) span.setAttribute("covelo.note", note);
      if (failed) span.setStatus({ code: SpanStatusCode.ERROR });
      if (collector) push(collector, { label, ms: performance.now() - start, outcome: failed ? "error" : "ok", note, proc });
      return result;
    } catch (err) {
      span.setAttribute("covelo.outcome", "error");
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      if (collector) push(collector, { label, ms: performance.now() - start, outcome: "error", proc });
      throw err;
    } finally {
      span.end();
    }
  });
}

function push(collector: Collector, span: TimingSpan) {
  if (collector.spans.length < MAX_SPANS) collector.spans.push(span);
}

/** Spans recorded so far on the current request (empty outside `withTiming`). */
export function currentSpans(): TimingSpan[] {
  return store.getStore()?.spans ?? [];
}

/** Milliseconds since `withTiming` started; 0 outside it. */
export function elapsedMs(): number {
  const c = store.getStore();
  return c ? performance.now() - c.startedAt : 0;
}

/** Metric names must be tokens; labels like "duffel.stays" are fine, anything else is flattened. */
function token(label: string): string {
  return label.replace(/[^A-Za-z0-9_.-]/g, "_");
}

/**
 * Serializes spans as a `Server-Timing` header value, e.g.
 * `duffel;dur=6120, hotelbeds;dur=4800, redis;dur=12;desc="miss"`.
 * `desc` joins the procedure (when known) and the note, e.g. `desc="board.posts.list hit"`;
 * failed calls say "error" instead of the note. Returns "" when empty.
 */
export function toServerTiming(spans: TimingSpan[], totalMs?: number): string {
  const parts = spans.map((s) => {
    const detail = s.outcome === "error" ? "error" : s.note;
    const desc = [s.proc, detail].filter(Boolean).join(" ");
    return `${token(s.label)};dur=${Math.round(s.ms)}${desc ? `;desc="${desc.replace(/"/g, "")}"` : ""}`;
  });
  if (totalMs !== undefined && parts.length) parts.push(`total;dur=${Math.round(totalMs)}`);
  return parts.join(", ");
}

/** Request header the proxy sets on /api/trpc calls: ms its Supabase `getUser()` took. */
export const PROXY_AUTH_HEADER = "x-covelo-proxy-auth-ms";

/** Reads the proxy's auth time off a request as a span, or null when absent or not a plain integer. */
export function proxyAuthSpan(headers: Headers): TimingSpan | null {
  const raw = headers.get(PROXY_AUTH_HEADER);
  if (!raw || !/^\d{1,6}$/.test(raw)) return null;
  return { label: "proxy-auth", ms: Number(raw), outcome: "ok" };
}

/**
 * Whether responses may carry `Server-Timing`. Dependency names and durations
 * are internal detail, so production never sends them (production performance
 * comes from traces, not response headers). Every other environment does.
 */
export function timingExposed(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV !== "production";
}
