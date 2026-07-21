import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('@/lib/redis', () => ({
  redis: {
    del: vi.fn(),
  },
}));

const isEnabledMock = vi.fn((_flag: string) => true);
vi.mock('@/lib/feature-flags', () => ({
  isEnabled: (flag: string) => isEnabledMock(flag),
}));

import { redis } from '@/lib/redis';
import { cacheKeys } from '@/lib/cache-config';
import { invalidateCacheFor } from '../scripts/portal-sync/cache';

beforeEach(() => {
  vi.clearAllMocks();
  isEnabledMock.mockReturnValue(true);
  vi.mocked(redis.del).mockResolvedValue(1);
});

describe('invalidateCacheFor', () => {
  it('deletes the transfer partners cache key for transfer_partner', async () => {
    await invalidateCacheFor('transfer_partner');
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.transferPartners());
    expect(redis.del).toHaveBeenCalledTimes(1);
  });

  it('deletes the hotel collections cache key for hotel_collection', async () => {
    await invalidateCacheFor('hotel_collection');
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.hotelCollections());
  });

  it('deletes the transfer bonuses cache key for transfer_bonus', async () => {
    await invalidateCacheFor('transfer_bonus');
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.transferBonuses());
  });

  it('deletes the spending bonuses cache key for spending_bonus', async () => {
    await invalidateCacheFor('spending_bonus');
    expect(redis.del).toHaveBeenCalledWith(cacheKeys.spendingBonuses());
  });

  it('no-ops when the redis integration flag is disabled', async () => {
    isEnabledMock.mockReturnValue(false);
    await invalidateCacheFor('transfer_partner');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('swallows redis errors instead of throwing', async () => {
    vi.mocked(redis.del).mockRejectedValue(new Error('redis down'));
    await expect(invalidateCacheFor('transfer_partner')).resolves.toBeUndefined();
  });
});
