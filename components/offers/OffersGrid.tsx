'use client';

import { TransferOfferCard, SpendingOfferCard } from '@/components/offers/OfferCard';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import type { OfferCategory } from '@/components/offers/OfferCategoryChips';

interface Props {
  transferBonuses: TransferBonus[];
  spendingBonuses: SpendingBonus[];
  filter: OfferCategory;
  isDark: boolean;
}

export function OffersGrid({ transferBonuses, spendingBonuses, filter, isDark }: Props) {
  const showTransfer = filter === 'all' || filter === 'transfer';
  const showSpending = filter === 'all' || filter === 'spending';

  const hasItems = (showTransfer && transferBonuses.length > 0) || (showSpending && spendingBonuses.length > 0);

  if (!hasItems) {
    return (
      <p className={`text-sm py-8 text-center ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>
        No offers in this category right now — check back soon.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {showTransfer && transferBonuses.map((offer) => (
        <TransferOfferCard key={offer.id} offer={offer} isDark={isDark} />
      ))}
      {showSpending && spendingBonuses.map((offer) => (
        <SpendingOfferCard key={offer.id} offer={offer} isDark={isDark} />
      ))}
    </div>
  );
}
