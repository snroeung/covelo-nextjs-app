import { getSupabaseAdmin } from '../../lib/supabase/admin';
import { redis } from '../../lib/redis';
import { cacheKeys } from '../../lib/cache-config';

// Service-role seeding of catalog offers for e2e specs. The partner name carries
// a unique token so a spec can find its own row; everything is removed by cleanup().

export interface SeededOffer {
  id: string;
  partner: string;
  /** The word to look for in the page: unique per seed */
  token: string;
  setEndDate: (date: string) => Promise<void>;
  cleanup: () => Promise<void>;
}

const dayOffset = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
export const isoDay = dayOffset;

async function dropOfferCache() {
  // The public lists are cached; the specs change rows underneath them
  await Promise.all([redis.del(cacheKeys.transferBonuses()), redis.del(cacheKeys.spendingBonuses())]).catch(() => {});
}

export async function seedTransferOffer(opts: { endDate?: string } = {}): Promise<SeededOffer> {
  const db = getSupabaseAdmin();
  const token = `ZZE2E${Math.random().toString(36).slice(2, 7)}`;
  const partner = `${token} Air`;
  const res = await db.from('transfer_bonuses').insert({
    issuer: 'chase', transfer_partner: partner, bonus_pct: 99, start_date: dayOffset(-5), end_date: opts.endDate ?? dayOffset(30),
    active: true, status: 'admin', source: 'admin', country: 'US', card_ids: [], tags: [],
  }).select('id').single();
  if (res.error) throw new Error(`seed offer: ${res.error.message}`);
  const id = res.data.id as string;
  await dropOfferCache();

  return {
    id, partner, token,
    setEndDate: async (date) => {
      await db.from('transfer_bonuses').update({ end_date: date }).eq('id', id);
      await dropOfferCache();
    },
    cleanup: async () => {
      await db.from('saved_offers').delete().eq('offer_id', id);
      await db.from('transfer_bonuses').delete().eq('id', id);
      await dropOfferCache();
    },
  };
}
