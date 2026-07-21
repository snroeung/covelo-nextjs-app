import { redis } from "@/lib/redis";
import { cacheKeys } from "@/lib/cache-config";
import { isEnabled } from "@/lib/feature-flags";
import type { RecordType } from "./schemas";

// Cron writes always land status='pending', active=false — invisible to the
// public cached reads until an admin approves (which the portalData router
// already invalidates). This is a defensive no-op in the common case, kept
// so a future direct-active write path doesn't silently serve stale cache.
const CACHE_KEYS_BY_RECORD_TYPE: Record<RecordType, () => string[]> = {
  transfer_partner: () => [cacheKeys.transferPartners()],
  hotel_collection: () => [cacheKeys.hotelCollections()],
  transfer_bonus: () => [cacheKeys.transferBonuses()],
  spending_bonus: () => [cacheKeys.spendingBonuses()],
};

export async function invalidateCacheFor(recordType: RecordType): Promise<void> {
  if (!isEnabled("integration:redis:portal-data")) return;
  const keys = CACHE_KEYS_BY_RECORD_TYPE[recordType]();
  await Promise.all(keys.map((key) => redis.del(key).catch(() => {})));
}
