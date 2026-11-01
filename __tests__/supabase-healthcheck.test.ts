import { describe, it, expect, vi, afterEach } from "vitest";
import { checkSupabase, describeDbError } from "@/scripts/supabase-healthcheck";

function client(result: { error: unknown } | Error) {
  const chain = {
    select: () => chain,
    limit: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  };
  return { from: () => chain } as never;
}

describe("describeDbError", () => {
  it("appends code, details and hint", () => {
    expect(describeDbError({ message: "boom", code: "42P01", details: "d", hint: "h" })).toBe(
      "boom (code=42P01 details=d hint=h)",
    );
  });
  it("returns the bare message when there is no extra info", () => {
    expect(describeDbError({ message: "boom" })).toBe("boom");
  });
});

describe("checkSupabase", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails on an invalid URL without calling fetch", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await checkSupabase(client({ error: null }), "t")).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fails when the host is unreachable and reports the cause", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } })));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkSupabase(client({ error: null }), "t")).toBe(false);
    expect(err.mock.calls[0][0]).toContain("ENOTFOUND");
  });

  it("fails when the query errors", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkSupabase(client({ error: { message: "nope", code: "401" } }), "t")).toBe(false);
  });

  it("passes when reachable and the query succeeds", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await checkSupabase(client({ error: null }), "t")).toBe(true);
  });
});
