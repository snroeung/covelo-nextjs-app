// Redis for the one cached board value: the shared topic list (plan §12.7).
// Posts, comments, votes, verdicts and reports are never cached.

import { redis } from "@/lib/redis";
import { isEnabled } from "@/lib/feature-flags";
import { cacheKeys } from "@/lib/cache-config";

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isEnabled("integration:redis:board")) return null;
  return redis.get<T>(key).catch(() => null);
}

export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!isEnabled("integration:redis:board")) return;
  await redis.set(key, value, { ex: ttl }).catch(() => {});
}

/** Topic lifecycle can change on any post or admin action; keep the shared chip list honest. */
export async function bustTopicsCache(): Promise<void> {
  if (!isEnabled("integration:redis:board")) return;
  await redis.del(cacheKeys.boardTopics()).catch(() => {});
}
