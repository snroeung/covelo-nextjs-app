'use client';

import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { buildStoryCopy } from '@/lib/discover/offerCopy';
import { PhotoPlaceholder } from '@/components/discover/PhotoPlaceholder';

type Offer = TransferBonus | SpendingBonus;

interface Props {
  offers: Offer[];
  onOpen: (offer: Offer) => void;
}

export function DiscoverSecondary({ offers, onOpen }: Props) {
  return (
    <>
      {offers.map((offer) => {
        const copy = buildStoryCopy(offer);
        return (
          <article
            key={offer.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(offer)}
            onKeyDown={(e) => e.key === 'Enter' && onOpen(offer)}
            className="pb-5 md:pb-0 md:pr-6 md:mr-6 border-b md:border-b-0 md:border-r cursor-pointer border-gph-line"
          >
            <PhotoPlaceholder issuer={offer.issuer} label={copy.kicker} className="h-[150px] rounded-md" />
            <div className="text-[10px] font-mono font-extrabold tracking-[0.14em] my-3.5 text-gph-action">
              {copy.kicker}
            </div>
            <h3 className="text-xl leading-tight font-extrabold tracking-tight text-gph-ink" style={{ textWrap: 'pretty' }}>
              {copy.headline}
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-gph-muted" style={{ textWrap: 'pretty' }}>
              {copy.dek}
            </p>
            <div className="flex items-baseline justify-between mt-3.5">
              <span className="text-[10px] font-mono font-extrabold tracking-[0.14em] text-gph-muted">{copy.time}</span>
              <span className="text-2xl font-mono font-extrabold tracking-tight leading-none text-gph-action">{copy.value}</span>
            </div>
          </article>
        );
      })}
    </>
  );
}
