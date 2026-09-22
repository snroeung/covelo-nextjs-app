'use client';

import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { buildStoryCopy } from '@/lib/discover/offerCopy';
import { PhotoPlaceholder } from '@/components/discover/PhotoPlaceholder';

type Offer = TransferBonus | SpendingBonus;

interface Props {
  offers: Offer[];
  isDark: boolean;
  onOpen: (offer: Offer) => void;
}

export function DiscoverSecondary({ offers, isDark, onOpen }: Props) {
  const line   = isDark ? 'border-gph-dark-line' : 'border-gph-line';
  const ink    = isDark ? 'text-gph-dark-ink'   : 'text-gph-ink';
  const muted  = isDark ? 'text-gph-dark-muted' : 'text-gph-muted';
  const accent = isDark ? 'text-gph-dark-action' : 'text-gph-action';

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
            className={`pb-5 md:pb-0 md:pr-6 md:mr-6 border-b md:border-b-0 md:border-r cursor-pointer ${line}`}
          >
            <PhotoPlaceholder issuer={offer.issuer} label={copy.kicker} className="h-[150px] rounded-md" />
            <div className={`text-[10px] font-mono font-extrabold tracking-[0.14em] my-3.5 ${accent}`}>
              {copy.kicker}
            </div>
            <h3 className={`text-xl leading-tight font-extrabold tracking-tight ${ink}`} style={{ textWrap: 'pretty' }}>
              {copy.headline}
            </h3>
            <p className={`mt-2.5 text-[13.5px] leading-relaxed ${muted}`} style={{ textWrap: 'pretty' }}>
              {copy.dek}
            </p>
            <div className="flex items-baseline justify-between mt-3.5">
              <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] ${muted}`}>{copy.time}</span>
              <span className={`text-2xl font-mono font-extrabold tracking-tight leading-none ${accent}`}>{copy.value}</span>
            </div>
          </article>
        );
      })}
    </>
  );
}
