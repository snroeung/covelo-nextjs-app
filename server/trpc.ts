import { initTRPC, TRPCError } from "@trpc/server";
import { isEnabled } from "@/lib/feature-flags";
import type { FlagName } from "@/lib/feature-flags";

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
