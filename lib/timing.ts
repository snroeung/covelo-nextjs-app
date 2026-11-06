import { AsyncLocalStorage } from "node:async_hooks";

/** One timed call to a dependency (Duffel, HotelBeds, Supabase, Redis, auth). */
export interface TimingSpan {
  label: string;
  ms: number;
  outcome: "ok" | "error";
  /** Optional detail, e.g. "hit" / "miss" for cache reads. Shown as `desc` in Server-Timing. */
  note?: string;
}

interface Collector {
  spans: TimingSpan[];
  startedAt: number;
}

const store = new AsyncLocalStorage<Collector>();

/** Max spans kept per request — a page of N per-row calls must not grow the header without bound. */
const MAX_SPANS = 40;

/** Runs `fn` with a fresh per-request collector. Call once at the request edge. */
export function withTiming<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ spans: [], startedAt: performance.now() }, fn);
}

/**
 * Times `fn` under `label` and records it on the current request's collector.
 * Outside `withTiming` (tests, scripts, jobs) it just runs `fn`. Never swallows
 * the result or the error.
 */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  note?: (result: T) => string | undefined,
): Promise<T> {
  const collector = store.getStore();
  if (!collector) return fn();
  const start = performance.now();
  try {
    const result = await fn();
    push(collector, { label, ms: performance.now() - start, outcome: "ok", note: note?.(result) });
    return result;
  } catch (err) {
    push(collector, { label, ms: performance.now() - start, outcome: "error" });
    throw err;
  }
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
 * Failed calls get `;desc="error"` unless a note was set. Returns "" when empty.
 */
export function toServerTiming(spans: TimingSpan[], totalMs?: number): string {
  const parts = spans.map((s) => {
    const desc = s.outcome === "error" ? "error" : s.note;
    return `${token(s.label)};dur=${Math.round(s.ms)}${desc ? `;desc="${desc.replace(/"/g, "")}"` : ""}`;
  });
  if (totalMs !== undefined && parts.length) parts.push(`total;dur=${Math.round(totalMs)}`);
  return parts.join(", ");
}
