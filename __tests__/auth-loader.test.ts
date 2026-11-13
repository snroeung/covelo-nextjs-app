import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

import { createAuthLoader } from "@/server/trpc";
import { hasSessionCookie } from "@/lib/supabase/session";

describe("hasSessionCookie", () => {
  it("matches the session cookie and its chunks", () => {
    expect(hasSessionCookie(["sb-abcdef-auth-token"])).toBe(true);
    expect(hasSessionCookie(["theme", "sb-abcdef-auth-token.0", "sb-abcdef-auth-token.1"])).toBe(true);
  });
  it("ignores unrelated cookies and the PKCE verifier", () => {
    expect(hasSessionCookie([])).toBe(false);
    expect(hasSessionCookie(["covelo_theme", "sb-abcdef-auth-token-code-verifier"])).toBe(false);
  });
});

describe("createAuthLoader", () => {
  beforeEach(() => getUser.mockReset());

  it("makes no Supabase call without a session cookie", async () => {
    const load = createAuthLoader(false);
    expect(await load()).toEqual({ user: null, error: null });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("asks Supabase once for a whole batch", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const load = createAuthLoader(true);
    const [a, b, c] = await Promise.all([load(), load(), load()]);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(a.user?.id).toBe("u1");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("returns the error so authed procedures can reject", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", message: "bad jwt" } });
    const { user, error } = await createAuthLoader(true)();
    expect(user).toBeNull();
    expect(error?.message).toBe("bad jwt");
  });
});
