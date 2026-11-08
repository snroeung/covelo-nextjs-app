import { afterEach, describe, expect, it } from "vitest";
import { currentSpans, elapsedMs, proxyAuthSpan, timed, timingExposed, toServerTiming, withTiming } from "@/lib/timing";

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
