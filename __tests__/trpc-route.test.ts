import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/server/routers/_app", async () => {
  const { router, publicProcedure } = await import("@/server/trpc");
  const { timed } = await import("@/lib/timing");
  return {
    appRouter: router({
      ping: publicProcedure.query(async () => {
        await timed("redis.get", async () => null, { note: (r) => (r ? "hit" : "miss") });
        return "pong";
      }),
    }),
  };
});

import { GET } from "@/app/api/trpc/[trpc]/route";

const call = (headers: Record<string, string> = {}) =>
  GET(new Request("http://localhost/api/trpc/ping", { headers }));

describe("GET /api/trpc — Server-Timing and [perf] log", () => {
  const OLD = { ...process.env };
  let info: { mock: { calls: unknown[][] }; mockRestore(): void };

  beforeEach(() => { info = vi.spyOn(console, "info").mockImplementation(() => {}); });
  afterEach(() => { process.env = { ...OLD }; info.mockRestore(); });

  it("outside production, sends one Server-Timing with the proxy hop, the span, its procedure and a total", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "beta";
    const res = await call({ "x-covelo-proxy-auth-ms": "42" });

    expect(res.status).toBe(200);
    const header = res.headers.get("server-timing") ?? "";
    expect(header).toContain("proxy-auth;dur=42");
    expect(header).toMatch(/redis\.get;dur=\d+;desc="ping miss"/);
    expect(header).toMatch(/total;dur=\d+/);
  });

  it("in production, sends no Server-Timing", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    const res = await call({ "x-covelo-proxy-auth-ms": "42" });

    expect(res.status).toBe(200);
    expect(res.headers.get("server-timing")).toBeNull();
  });

  it("logs one [perf] line with the spans in every environment, production included", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    await call({ "x-covelo-proxy-auth-ms": "7" });

    const line = info.mock.calls.find((args) => args[0] === "[perf]");
    expect(line).toBeTruthy();
    const logged = JSON.parse(String(line![1]));
    expect(logged.path).toBe("ping");
    expect(logged.spans).toEqual(expect.arrayContaining([
      expect.objectContaining({ l: "proxy-auth", ms: 7 }),
      expect.objectContaining({ l: "redis.get", o: "ok", n: "miss", p: "ping" }),
    ]));
  });

  it("ignores a junk proxy header instead of echoing it", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "beta";
    const res = await call({ "x-covelo-proxy-auth-ms": "12;evil=1" });
    expect(res.headers.get("server-timing")).not.toContain("proxy-auth");
    expect(res.headers.get("server-timing")).not.toContain("evil");
  });
});
