'use client';

import { btn } from '@/components/ui/button';
import Link from 'next/link';
import { todayPill } from '@/lib/discover/offerCopy';
import type { SpendingBonus, TransferBonus } from '@/lib/types/offers';
import { SavedOffersMenu } from '@/components/offers/SavedOffersMenu';

interface Props {
  isDark: boolean;
  offerCount: number;
  /** A saved offer was picked: show it in the page's offer view */
  onOpenOffer: (offer: TransferBonus | SpendingBonus) => void;
}

export function DiscoverMasthead({ isDark, offerCount, onOpenOffer }: Props) {
  const pillBg = isDark ? 'bg-gph-dark-actionsoft text-gph-dark-action' : 'bg-gph-actionsoft text-gph-action';

  return (
    <div className="flex items-end justify-between gap-6 flex-wrap pb-3.5 border-b-2 border-gph-ink">
      <div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] px-2 py-1 rounded ${pillBg}`}>
            {todayPill()}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-none tracking-tight text-gph-ink">
          Discover
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <SavedOffersMenu onOpen={onOpenOffer} />
        <Link
          href="/offers"
          target="_blank"
          rel="noopener noreferrer"
          className={btn('primary')}
        >
          See all offers · {offerCount}
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
