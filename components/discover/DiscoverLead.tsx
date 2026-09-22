'use client';

import type { TransferBonus } from '@/lib/types/offers';
import { buildLeadCopy } from '@/lib/discover/offerCopy';
import { PhotoPlaceholder } from '@/components/discover/PhotoPlaceholder';

interface Props {
  offer: TransferBonus;
  isDark: boolean;
  onOpen: () => void;
}

export function DiscoverLead({ offer, isDark, onOpen }: Props) {
  const copy = buildLeadCopy(offer);

  const ink    = isDark ? 'text-gph-dark-ink'   : 'text-gph-ink';
  const muted  = isDark ? 'text-gph-dark-muted' : 'text-gph-muted';
  const accent = isDark ? 'text-gph-dark-action' : 'text-gph-action';
  const line   = isDark ? 'border-gph-dark-line' : 'border-gph-line';
  const plaqueBg = isDark ? 'bg-gph-dark-action' : 'bg-gph-action';
  const plaqueInk = isDark ? 'text-gph-dark-bg' : 'text-white';

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={`grid grid-cols-1 md:grid-cols-[1.12fr_1fr] gap-6 md:gap-8 pb-6 border-b cursor-pointer ${line}`}
    >
      <div className="relative">
        <PhotoPlaceholder issuer={offer.issuer} label={copy.kicker} className="h-[220px] md:h-full md:min-h-[320px] rounded-md" />
        <div className={`absolute right-3 bottom-3 md:right-4 md:bottom-4 flex items-baseline gap-2 px-3.5 py-2 rounded ${plaqueBg}`}>
          <span className={`text-2xl md:text-[34px] font-mono font-extrabold tracking-tight leading-none ${plaqueInk}`}>
            {copy.value}
          </span>
          <span className={`text-[10px] font-mono font-bold tracking-[0.08em] ${isDark ? 'text-gph-dark-bg/65' : 'text-white/65'}`}>
            {copy.valueDetail.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <div className={`text-[10px] font-mono font-extrabold tracking-[0.14em] mb-3 ${accent}`}>
          {copy.kicker}
        </div>
        <h2 className={`text-[28px] md:text-[42px] leading-[1.05] font-extrabold tracking-tight ${ink}`} style={{ textWrap: 'pretty' }}>
          {copy.headline}
        </h2>
        <p className={`mt-4 text-[15.5px] leading-relaxed ${muted}`} style={{ textWrap: 'pretty' }}>
          {copy.standfirst}
        </p>
        <div className={`mt-5 text-[10px] font-mono font-extrabold tracking-[0.14em] ${muted}`}>
          {copy.time}
        </div>
      </div>
    </article>
  );
}
