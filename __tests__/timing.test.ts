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
      await timed("redis.get", async () => { await sleep(15); return null; }, (r) => (r ? "hit" : "miss"));
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
  const h = (token?: string) => new Headers(token ? { "x-perf-token": token } : {});

  it("is open outside production", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "beta";
    expect(timingExposed(h())).toBe(true);
  });

  it("is hidden in production without a configured token", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    delete process.env.PERF_TIMING_TOKEN;
    expect(timingExposed(h("anything"))).toBe(false);
  });

  it("needs the exact token in production", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.PERF_TIMING_TOKEN = "s3cret";
    expect(timingExposed(h())).toBe(false);
    expect(timingExposed(h("wrong"))).toBe(false);
    expect(timingExposed(h("s3cret"))).toBe(true);
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
