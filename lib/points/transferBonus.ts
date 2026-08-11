import { useQuery } from '@tanstack/react-query';
import type { PointsResult, PortalId, TransferResult, TransferSourceCard } from '@/lib/points/types';
import { trpc } from '@/lib/trpc-client';
import type { TransferBonus, Issuer } from '@/lib/types/offers';

export const ISSUER_TO_PORTAL: Record<Issuer, PortalId> = {
  chase: 'chase', amex: 'amex', c1: 'c1', bilt: 'bilt', citi: 'citi',
};

export const ISSUER_LOYALTY_NAME: Record<Issuer, string> = {
  chase: 'Chase Ultimate Rewards',
  amex: 'Amex Membership Rewards',
  c1: 'Capital One Miles',
  bilt: 'Bilt Rewards',
  citi: 'Citi ThankYou Rewards',
};

export function formatBonusEndDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Server orders by bonus_pct desc, so find() returns the biggest match.
// Date-window guard: admin sessions bypass the public RLS end_date filter,
// so re-check here to only badge bonuses currently live.
export function findBonusForTransfer(
  t: TransferResult,
  bonuses: TransferBonus[],
  now: number,
): TransferBonus | undefined {
  return bonuses.find(
    b =>
      ISSUER_TO_PORTAL[b.issuer] === t.sourcePortalId &&
      b.transfer_partner === t.partnerProgram &&
      new Date(b.end_date).getTime() > now &&
      (!b.start_date || new Date(b.start_date).getTime() <= now),
  );
}

/**
 * The bonus that applies to a card the user actually holds, and which card it
 * is. `findBonusForTransfer` only ever looks at the row's default source, which
 * misses a promo sitting on a second eligible card — and a promo the user
 * cannot use has no business changing the row's numbers. Bonuses arrive ordered
 * by bonus_pct desc, so the first eligible match is the biggest one.
 */
export function findBonusForEligibleCards(
  t: TransferResult,
  bonuses: TransferBonus[],
  now: number,
): { bonus: TransferBonus; card: TransferSourceCard; portalId: PortalId } | undefined {
  const owned = (t.sourceIssuers ?? []).filter(i => i.owned);
  if (owned.length === 0) return undefined;
  for (const bonus of bonuses) {
    if (bonus.transfer_partner !== t.partnerProgram) continue;
    if (new Date(bonus.end_date).getTime() <= now) continue;
    if (bonus.start_date && new Date(bonus.start_date).getTime() > now) continue;
    const issuer = owned.find(i => i.portalId === ISSUER_TO_PORTAL[bonus.issuer]);
    // The issuer's best card is the one worth transferring from under the promo.
    if (issuer) return { bonus, card: issuer.best, portalId: issuer.portalId };
  }
  return undefined;
}

export function findLiveBonus(
  result: PointsResult,
  bonuses: TransferBonus[],
  now: number,
): TransferBonus | undefined {
  for (const t of result.transferAlternatives) {
    const match = findBonusForTransfer(t, bonuses, now);
    if (match) return match;
  }
  return undefined;
}

export function useLiveTransferBonus(result: PointsResult | null): TransferBonus | undefined {
  // Cached shape must stay the bare array — the offers page reads this same key
  // and spreads it. `dataUpdatedAt` supplies the fetch time so the date-window
  // check never calls Date.now() during render.
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['offers.transferBonuses'],
    queryFn:  () => trpc.offers.listTransferBonuses.query(),
    staleTime: 15 * 60 * 1000,
  });
  if (!result || !data || !dataUpdatedAt) return undefined;
  return findLiveBonus(result, data, dataUpdatedAt);
}
