'use client';

import Link from 'next/link';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { OfferRow } from '@/components/discover/OfferRow';

type Offer = TransferBonus | SpendingBonus;

interface Props {
  offers: Offer[];
  isDark: boolean;
  onOpen: (offer: Offer) => void;
}

const COLLAPSED_COUNT = 3;

export function DiscoverRail({ offers, isDark, onOpen }: Props) {
  const ghostCls = isDark
    ? 'bg-gph-dark-card border border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
    : 'bg-gph-card border border-gph-line text-gph-ink hover:bg-gph-linesoft';

  const visible = offers.slice(0, COLLAPSED_COUNT);
  const hasMore = offers.length > COLLAPSED_COUNT;

  if (offers.length === 0) return null;

  return (
    <div>
      <div className="pb-2 mb-1 border-b-[1.5px] text-[10px] font-mono font-extrabold tracking-[0.14em] border-gph-ink text-gph-muted">
        MORE OFFERS
      </div>
      {visible.map((offer) => (
        <OfferRow key={offer.id} offer={offer} onOpen={onOpen} />
      ))}
      {hasMore && (
        <Link
          href="/offers"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-1.5 w-full mt-4 px-4 py-2.5 rounded-md text-[11.5px] font-bold transition-colors min-h-11 ${ghostCls}`}
        >
          See all offers
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </div>
  );
}
