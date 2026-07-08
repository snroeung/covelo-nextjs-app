import { initTRPC, TRPCError } from "@trpc/server";
import { isEnabled } from "@/lib/feature-flags";
import type { FlagName } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";

const t = initTRPC.create({
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: undefined,
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

/**
 * Admin-only procedure. Verifies the caller's Supabase JWT and checks
 * app_metadata.role === "admin". app_metadata can only be set via the
 * service role key, so it cannot be spoofed by regular users.
 */
export function adminProcedure(flag: FlagName) {
  return t.procedure.use(async ({ next }) => {
    if (!isEnabled(flag)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Feature "${flag}" is not available in this environment.`,
      });
    }
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
    }
    const role = (user.app_metadata as Record<string, unknown>)?.role;
    if (role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
    }
    return next();
  });
}
