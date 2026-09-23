'use client';

import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { buildStoryCopy } from '@/lib/discover/offerCopy';
import { gphTheme } from '@/lib/discover/theme';

type Offer = TransferBonus | SpendingBonus;

interface Props {
  offer: Offer;
  onOpen: (offer: Offer) => void;
}

export function OfferRow({ offer, onOpen }: Props) {
  const { line, ink, muted, accent } = gphTheme;

  const copy = buildStoryCopy(offer);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(offer)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(offer)}
      className={`py-3 border-b cursor-pointer transition-transform hover:translate-x-1 ${line}`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] ${accent}`}>{copy.cat}</span>
        <span className={`text-sm font-mono font-extrabold tracking-tight ${ink}`}>{copy.value}</span>
      </div>
      <div className={`text-sm leading-snug font-bold tracking-tight ${ink}`} style={{ textWrap: 'pretty' }}>
        {copy.headline}
      </div>
      <div className={`mt-1.5 text-[9px] font-mono font-extrabold tracking-[0.1em] ${muted}`}>
        {copy.time}
      </div>
    </div>
  );
}
