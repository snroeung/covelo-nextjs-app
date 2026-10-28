import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Refetch a list after a write that changes it. The UI flips optimistically, so
 * the list can be opened — and fetched — before the write has committed. With no
 * data yet, a plain invalidate reuses that in-flight fetch and keeps its stale
 * answer, so cancel it first: the refetch then starts after the write.
 */
export async function refreshAfterWrite(qc: QueryClient, key: QueryKey): Promise<void> {
  await qc.cancelQueries({ queryKey: key });
  await qc.invalidateQueries({ queryKey: key });
}
