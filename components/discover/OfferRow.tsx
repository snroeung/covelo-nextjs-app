'use client';

import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { buildStoryCopy, isTransfer } from '@/lib/discover/offerCopy';
import { SaveOfferButton } from '@/components/offers/SaveOfferButton';

type Offer = TransferBonus | SpendingBonus;

interface Props {
  offer: Offer;
  onOpen: (offer: Offer) => void;
}

export function OfferRow({ offer, onOpen }: Props) {
  const copy = buildStoryCopy(offer);
  return (
    <div data-testid="offer-row" className="flex items-start gap-1 border-b border-gph-line">
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(offer)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(offer)}
      className="min-w-0 flex-1 py-3 cursor-pointer transition-transform hover:translate-x-1"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-mono font-extrabold tracking-[0.14em] text-gph-action">{copy.cat}</span>
        {/* A transfer's headline already says "10% premium"; repeating it on the right is noise */}
        {!isTransfer(offer) && <span className="text-sm font-mono font-extrabold tracking-tight text-gph-ink">{copy.value}</span>}
      </div>
      <div className="text-sm leading-snug font-bold tracking-tight text-gph-ink" style={{ textWrap: 'pretty' }}>
        {copy.headline}
      </div>
      <div className="mt-1.5 text-[9px] font-mono font-extrabold tracking-[0.1em] text-gph-muted">
        {copy.time}
      </div>
    </div>
    <div className="pt-1.5"><SaveOfferButton offer={offer} /></div>
    </div>
  );
}
