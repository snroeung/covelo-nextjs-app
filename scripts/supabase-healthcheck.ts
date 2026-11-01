import type { SupabaseClient } from "@supabase/supabase-js";

type DbError = { message: string; details?: string | null; hint?: string | null; code?: string | null };

/** Error text with Supabase's code/details/hint appended — `fetch failed` alone hides the real cause. */
export function describeDbError(error: DbError): string {
  const extra = [error.code && `code=${error.code}`, error.details && `details=${error.details}`, error.hint && `hint=${error.hint}`]
    .filter(Boolean)
    .join(" ");
  return extra ? `${error.message} (${extra})` : error.message;
}

function describeThrown(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { code?: string; message?: string } | undefined;
  return cause ? `${err.message} (cause: ${cause.code ?? ""} ${cause.message ?? cause})` : err.message;
}

/**
 * Probes Supabase before a job run: host reachability, then an authenticated query.
 * Logs the host only (never the key). Returns false on any failure so the caller can abort
 * instead of failing later with an opaque `fetch failed`.
 */
export async function checkSupabase(supabase: SupabaseClient, table: string): Promise<boolean> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let host: string;
  try {
    host = new URL(rawUrl.trim()).host;
  } catch {
    console.error(`[healthcheck] NEXT_PUBLIC_SUPABASE_URL is not a valid URL (length ${rawUrl.length}, starts with "${rawUrl.slice(0, 8)}")`);
    return false;
  }
  if (rawUrl !== rawUrl.trim()) console.error("[healthcheck] NEXT_PUBLIC_SUPABASE_URL has leading/trailing whitespace");

  try {
    const res = await fetch(`${rawUrl.trim().replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: process.env.SUPABASE_SECRET_KEY ?? "" },
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`[healthcheck] ${host} reachable (auth health HTTP ${res.status})`);
  } catch (err) {
    console.error(`[healthcheck] cannot reach ${host}: ${describeThrown(err)}`);
    return false;
  }

  try {
    const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      console.error(`[healthcheck] query on ${table} failed: ${describeDbError(error)}`);
      return false;
    }
  } catch (err) {
    console.error(`[healthcheck] query on ${table} threw: ${describeThrown(err)}`);
    return false;
  }
  console.log("[healthcheck] database OK");
  return true;
}
