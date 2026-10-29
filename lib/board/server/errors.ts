// Server-only board helpers: they take the service-role client and throw
// TRPCErrors. Never import from client code.

import { TRPCError } from "@trpc/server";
import type { LimitResult } from "@/lib/board/limits";

/** Throws the TRPCError for a failed limit check; rate limits carry retryAt for the client. */
export function throwIfBlocked(result: LimitResult): void {
  if (result.ok) return;
  if (result.code === "TOO_MANY_REQUESTS") {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: result.message,
      cause: Object.assign(new Error(result.message), { retryAt: result.retryAt.toISOString() }),
    });
  }
  throw new TRPCError({ code: result.code, message: result.message });
}

/** Unwraps a Supabase result, turning a database error into a 500. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what = "query"): T {
  if (res.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Board ${what} failed: ${res.error.message}` });
  return res.data as T;
}
