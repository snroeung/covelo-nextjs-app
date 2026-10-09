'use client';

import { useQuery } from '@tanstack/react-query';
import type { PointsResult, TransferResult } from '@/lib/points/types';
import { rankOptions } from '@/lib/points/rankOptions';
import { buildRowView, type OptionRowView } from '@/lib/points/rowView';
import { findBonusForEligibleCards } from '@/lib/points/transferBonus';
import { trpc } from '@/lib/trpc-client';

/**
 * Every booking option for a result, best displayed rate first.
 *
 * Bonuses are matched against the cards the user holds, not the row's default
 * issuer — a promo on a card they don't own must not badge the row or move its
 * numbers. Ranking happens on the raw rate but buildRowView folds bonuses into
 * cpp, so the list is re-sorted on the displayed value: a lower cpp never shows
 * above a higher one.
 *
 * The query key is shared with the offers page, so its cached value stays the
 * bare array. `dataUpdatedAt` is the clock for the bonus date-window check
 * (admin sessions bypass the public RLS end_date filter); it avoids calling the
 * impure Date.now() during render. No staleTime override — a promo starting or
 * ending shouldn't sit stale in an open tab.
 */
export function useRankedViews(result: PointsResult | null): OptionRowView[] {
  const { data: transferBonuses = [], dataUpdatedAt } = useQuery({
    queryKey: ['offers.transferBonuses'],
    queryFn:  () => trpc.offers.listTransferBonuses.query(),
  });
  if (!result) return [];
  const now = dataUpdatedAt || null;
  const bonusFor = (t: TransferResult) =>
    now === null ? undefined : findBonusForEligibleCards(t, transferBonuses, now);

  return rankOptions(result)
    .map(row => {
      const match = row.kind === 'transfer' ? bonusFor(row.transfer) : undefined;
      return buildRowView(row, result, match?.bonus, match?.portalId);
    })
    .sort((a, b) => (b.cpp ?? -Infinity) - (a.cpp ?? -Infinity));
}
