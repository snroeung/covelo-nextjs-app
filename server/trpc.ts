import { initTRPC, TRPCError } from "@trpc/server";
import type { AuthError, User } from "@supabase/supabase-js";
import { isEnabled } from "@/lib/feature-flags";
import type { FlagName } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";

/** What every request carries before auth: the viewer's IANA time zone (already validated, UTC when unknown). */
export interface TrpcContext {
  timeZone?: string;
  /** Resolves the caller once per HTTP request (see `createAuthLoader`). Absent in tests/jobs, where each procedure asks Supabase itself. */
  getAuth?: () => Promise<AuthResult>;
}

export interface AuthResult {
  user: User | null;
  error: AuthError | null;
}

async function fetchAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await timed("supabase.auth", () => supabase.auth.getUser(), {
    // A signed-out visitor has no session: getUser() reports that as an error, but nothing failed
    failed: (r) => !!r.error && r.error.name !== "AuthSessionMissingError",
  });
  return { user, error };
}

/**
 * One auth lookup per HTTP request. A batch of N procedures shares the single result, and a
 * visitor with no session cookie (`hasSession` false) costs no Supabase round trip at all.
 * Build one per request in the route's createContext.
 */
export function createAuthLoader(hasSession: boolean): () => Promise<AuthResult> {
  let pending: Promise<AuthResult> | undefined;
  return () => {
    if (!hasSession) return Promise.resolve({ user: null, error: null });
    return (pending ??= fetchAuth());
  };
}

function resolveAuth(ctx: TrpcContext): Promise<AuthResult> {
  return ctx.getAuth ? ctx.getAuth() : fetchAuth();
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    // Rate-limit errors carry when the caller may retry as `cause.retryAt` (ISO string)
    const retryAt = (error.cause as { retryAt?: unknown } | undefined)?.retryAt;
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: undefined,
        ...(typeof retryAt === "string" ? { retryAt } : {}),
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Returns a procedure pre-configured with a feature flag guard.
 * Throws TRPCError { code: "NOT_FOUND" } before input validation if the flag
 * is disabled in the current environment.
 *
 * Usage:
 *   flaggedProcedure("api:flights").input(schema).mutation(...)
 */
export function flaggedProcedure(flag: FlagName) {
  return t.procedure.use(async ({ next }) => {
    if (!isEnabled(flag)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Feature "${flag}" is not available in this environment.`,
      });
    }
    return next();
  });
}

/** True when the Supabase user carries app_metadata.role === "admin" (service-role-set, so unspoofable). */
export function isAdminUser(user: { app_metadata?: unknown } | null | undefined): boolean {
  return (user?.app_metadata as Record<string, unknown> | undefined)?.role === "admin";
}

/**
 * Public procedure that still knows who is asking: ctx.viewer is
 * { id, isAdmin }, with id null when signed out. For reads whose visibility
 * depends on the viewer (the board feed).
 */
export function viewerProcedure(flag: FlagName) {
  return t.procedure.use(async ({ ctx, next }) => {
    if (!isEnabled(flag)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Feature "${flag}" is not available in this environment.`,
      });
    }
    const { user } = await resolveAuth(ctx);
    return next({ ctx: { viewer: { id: user?.id ?? null, isAdmin: isAdminUser(user), timeZone: ctx.timeZone } } });
  });
}

/**
 * Admin-only procedure. Verifies the caller's Supabase JWT and checks
 * app_metadata.role === "admin". app_metadata can only be set via the
 * service role key, so it cannot be spoofed by regular users. ctx carries the
 * admin (user, session client, viewer) for resolvers that record who acted.
 */
export function adminProcedure(flag: FlagName) {
  return t.procedure.use(async ({ ctx, next }) => {
    if (!isEnabled(flag)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Feature "${flag}" is not available in this environment.`,
      });
    }
    const supabase = await createClient();
    const { user, error } = await resolveAuth(ctx);
    if (error || !user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
    }
    if (!isAdminUser(user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
    }
    return next({ ctx: { user, supabase, isAdmin: true as const, viewer: { id: user.id, isAdmin: true, timeZone: ctx.timeZone } } });
  });
}

/**
 * Signed-in-only procedure. Verifies the caller's Supabase session and hands
 * the user and the session-scoped client to the resolver via ctx, so RLS
 * policies keyed on auth.uid() apply to its writes.
 */
export function authedProcedure(flag: FlagName) {
  return t.procedure.use(async ({ ctx, next }) => {
    if (!isEnabled(flag)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Feature "${flag}" is not available in this environment.`,
      });
    }
    const supabase = await createClient();
    const { user, error } = await resolveAuth(ctx);
    if (error || !user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
    }
    const isAdmin = isAdminUser(user);
    return next({ ctx: { user, supabase, isAdmin, viewer: { id: user.id, isAdmin, timeZone: ctx.timeZone } } });
  });
}
