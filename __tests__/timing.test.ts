import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const otel = vi.hoisted(() => {
  interface FakeSpan {
    name: string;
    attrs: Record<string, unknown>;
    status?: { code: number };
    exceptions: unknown[];
    ended: boolean;
  }
  const spans: FakeSpan[] = [];
  return { spans };
});

vi.mock("@opentelemetry/api", () => ({
  SpanStatusCode: { UNSET: 0, OK: 1, ERROR: 2 },
  trace: {
    getActiveSpan: () => undefined,
    getTracer: () => ({
      startActiveSpan: (name: string, opts: { attributes?: Record<string, unknown> }, fn: (s: unknown) => unknown) => {
        const span = {
          name,
          attrs: { ...opts.attributes },
          status: undefined as { code: number } | undefined,
          exceptions: [] as unknown[],
          ended: false,
          setAttribute(k: string, v: unknown) { this.attrs[k] = v; },
          setStatus(s: { code: number }) { this.status = s; },
          recordException(e: unknown) { this.exceptions.push(e); },
          end() { this.ended = true; },
        };
        otel.spans.push(span);
        return fn(span);
      },
    }),
  },
}));
import { currentSpans, elapsedMs, proxyAuthSpan, timed, timingExposed, toServerTiming, withProcedure, withTiming } from "@/lib/timing";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("timing", () => {
  it("runs fn untouched outside withTiming", async () => {
    expect(await timed("x", async () => 7)).toBe(7);
    expect(currentSpans()).toEqual([]);
    expect(elapsedMs()).toBe(0);
  });

  it("records ok spans with duration and note", async () => {
    await withTiming(async () => {
      await timed("redis.get", async () => { await sleep(15); return null; }, { note: (r) => (r ? "hit" : "miss") });
      const [span] = currentSpans();
      expect(span.label).toBe("redis.get");
      expect(span.outcome).toBe("ok");
      expect(span.note).toBe("miss");
      expect(span.ms).toBeGreaterThanOrEqual(10);
    });
  });

  it("records error spans and rethrows", async () => {
    await withTiming(async () => {
      await expect(timed("duffel", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
      expect(currentSpans()[0].outcome).toBe("error");
    });
  });

  it("marks a returned { error } as an error span when `failed` says so", async () => {
    await withTiming(async () => {
      const res = await timed("supabase.q", async () => ({ data: null, error: { message: "boom" } }), { failed: (r) => !!r.error });
      expect(res.error?.message).toBe("boom");
      await timed("supabase.ok", async () => ({ data: [1], error: null }), { failed: (r) => !!r.error });
      expect(currentSpans().map((s) => s.outcome)).toEqual(["error", "ok"]);
    });
  });

  it("records a failed Redis call as an error when the catch sits outside timed", async () => {
    await withTiming(async () => {
      const value = await timed("redis.get", async () => { throw new Error("ECONNREFUSED"); }, { note: (r) => (r ? "hit" : "miss") }).catch(() => null);
      expect(value).toBeNull();
      expect(currentSpans()[0]).toMatchObject({ label: "redis.get", outcome: "error" });
      expect(currentSpans()[0].note).toBeUndefined();
    });
  });

  it("keeps parallel spans on the same request and isolates requests", async () => {
    const [a, b] = await Promise.all([
      withTiming(async () => {
        await Promise.all([timed("a1", () => sleep(5)), timed("a2", () => sleep(5))]);
        return currentSpans().map((s) => s.label).sort();
      }),
      withTiming(async () => {
        await timed("b1", () => sleep(5));
        return currentSpans().map((s) => s.label);
      }),
    ]);
    expect(a).toEqual(["a1", "a2"]);
    expect(b).toEqual(["b1"]);
  });

  it("caps spans per request", async () => {
    await withTiming(async () => {
      for (let i = 0; i < 100; i++) await timed("n", async () => i);
      expect(currentSpans().length).toBe(40);
    });
  });

  it("formats Server-Timing", () => {
    const h = toServerTiming(
      [
        { label: "duffel.stays", ms: 6120.4, outcome: "ok" },
        { label: "hotelbeds search", ms: 4800, outcome: "error" },
        { label: "redis.get", ms: 12, outcome: "ok", note: 'mi"ss' },
      ],
      6200,
    );
    expect(h).toBe('duffel.stays;dur=6120, hotelbeds_search;dur=4800;desc="error", redis.get;dur=12;desc="miss", total;dur=6200');
    expect(toServerTiming([], 5)).toBe("");
  });
});

describe("timingExposed", () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  it("is on outside production", () => {
    for (const env of ["local", "beta", undefined]) {
      if (env) process.env.NEXT_PUBLIC_APP_ENV = env; else delete process.env.NEXT_PUBLIC_APP_ENV;
      expect(timingExposed()).toBe(true);
    }
  });

  it("is off in production", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    expect(timingExposed()).toBe(false);
  });
});

describe("proxyAuthSpan", () => {
  it("reads a plain integer", () => {
    expect(proxyAuthSpan(new Headers({ "x-covelo-proxy-auth-ms": "87" }))).toMatchObject({ label: "proxy-auth", ms: 87, outcome: "ok" });
  });
  it("rejects missing, negative, decimal and junk values", () => {
    expect(proxyAuthSpan(new Headers())).toBeNull();
    for (const v of ["-1", "1.5", "abc", "12;evil", "1234567"]) {
      expect(proxyAuthSpan(new Headers({ "x-covelo-proxy-auth-ms": v }))).toBeNull();
    }
  });
});

describe("timed → OpenTelemetry span", () => {
  beforeEach(() => { otel.spans.length = 0; });

  it("opens a span with dep, outcome and note, and ends it", async () => {
    await timed("redis.get", async () => "v", { note: () => "hit" });
    expect(otel.spans).toHaveLength(1);
    expect(otel.spans[0]).toMatchObject({ name: "redis.get", ended: true, attrs: { "covelo.dep": "redis", "covelo.outcome": "ok", "covelo.note": "hit" } });
    expect(otel.spans[0].status).toBeUndefined();
  });

  it("sets ERROR status and records the exception on throw, still ending the span", async () => {
    await expect(timed("duffel.stays", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(otel.spans[0].status?.code).toBe(2);
    expect(otel.spans[0].exceptions).toHaveLength(1);
    expect(otel.spans[0].attrs["covelo.outcome"]).toBe("error");
    expect(otel.spans[0].ended).toBe(true);
  });

  it("sets ERROR status when `failed` says so, without throwing", async () => {
    const r = await timed("supabase.q", async () => ({ error: { message: "x" } }), { failed: (x) => !!x.error });
    expect(r.error.message).toBe("x");
    expect(otel.spans[0].status?.code).toBe(2);
    expect(otel.spans[0].exceptions).toHaveLength(0);
  });

  it("emits spans even outside withTiming (traces do not need the collector)", async () => {
    expect(currentSpans()).toEqual([]);
    await timed("board.queryFeed", async () => 1);
    expect(otel.spans.map((s) => s.name)).toEqual(["board.queryFeed"]);
  });
});

describe("withProcedure", () => {
  beforeEach(() => { otel.spans.length = 0; });

  it("tags spans made inside a procedure, and only those", async () => {
    await withTiming(async () => {
      await timed("before", async () => 1);
      await withProcedure("board.posts.list", () => timed("redis.get", async () => null, { note: (r) => (r ? "hit" : "miss") }));
      await timed("after", async () => 1);
      expect(currentSpans().map((s) => s.proc)).toEqual([undefined, "board.posts.list", undefined]);
    });
  });

  it("keeps the procedures of one batched request apart when they run in parallel", async () => {
    await withTiming(async () => {
      await Promise.all([
        withProcedure("a.one", async () => { await sleep(10); await timed("x", async () => 1); }),
        withProcedure("b.two", async () => { await sleep(1); await timed("y", async () => 1); }),
      ]);
      const byLabel = Object.fromEntries(currentSpans().map((s) => [s.label, s.proc]));
      expect(byLabel).toEqual({ x: "a.one", y: "b.two" });
    });
  });

  it("puts the procedure on the OTel span as trpc.procedure", async () => {
    await withProcedure("stays.search", () => timed("duffel.stays", async () => 1));
    expect(otel.spans[0].attrs["trpc.procedure"]).toBe("stays.search");
    await timed("no.proc", async () => 1);
    expect(otel.spans[1].attrs["trpc.procedure"]).toBeUndefined();
  });

  it("shows the procedure in Server-Timing desc, before the note", () => {
    expect(toServerTiming([
      { label: "redis.get", ms: 5, outcome: "ok", note: "hit", proc: "board.posts.list" },
      { label: "duffel.stays", ms: 9, outcome: "error", note: "x", proc: "stays.search" },
      { label: "plain", ms: 1, outcome: "ok" },
    ])).toBe('redis.get;dur=5;desc="board.posts.list hit", duffel.stays;dur=9;desc="stays.search error", plain;dur=1');
  });
});
